#include "httplib.h"
#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include "stats.h"
#include <fstream>
#include <sstream>
using namespace std;

struct Event {
    int id;
    string name, club, venue, date;
    int start, end;   // minutes since midnight
};

// ---------- Hash Table (find an event by ID) ----------
class HashTable {
    static const int SIZE = 101;
    vector<Event> buckets[SIZE];
    int hashFn(int id) { return id % SIZE; }
public:
    void insert(const Event& e) { buckets[hashFn(e.id)].push_back(e); }
    Event* find(int id) {
        for (auto& e : buckets[hashFn(id)])
            if (e.id == id) return &e;
        return nullptr;
    }
    vector<Event> all() {
        vector<Event> out;
        for (int i = 0; i < SIZE; i++)
            for (auto& e : buckets[i]) out.push_back(e);
        return out;
    }
};

// ---------- Interval Tree (find overlapping time ranges) ----------
struct Node {
    int id;
    long long lo, hi, maxHi;
    Node *left, *right;
    Node(int i, long long l, long long h)
        : id(i), lo(l), hi(h), maxHi(h), left(nullptr), right(nullptr) {}
};

class IntervalTree {
    Node* root = nullptr;

    Node* insert(Node* n, int id, long long lo, long long hi) {
        if (!n) return new Node(id, lo, hi);
        if (lo < n->lo) n->left = insert(n->left, id, lo, hi);
        else            n->right = insert(n->right, id, lo, hi);
        n->maxHi = max(n->maxHi, hi);
        return n;
    }

    void query(Node* n, long long lo, long long hi, vector<int>& out) {
        if (!n) return;
        if (n->left && n->left->maxHi > lo) query(n->left, lo, hi, out);
        if (n->lo < hi && lo < n->hi) out.push_back(n->id);
        if (n->lo < hi) query(n->right, lo, hi, out);
    }
public:
    void insert(int id, long long lo, long long hi) { root = insert(root, id, lo, hi); }
    vector<int> findOverlaps(long long lo, long long hi) {
        vector<int> out;
        query(root, lo, hi, out);
        return out;
    }
};

HashTable table;
IntervalTree tree;
int nextId = 1;

int toMinutes(const string& t) {
    return stoi(t.substr(0, 2)) * 60 + stoi(t.substr(3, 2));
}

long long absTime(const string& date, int minutes) {
    int y = stoi(date.substr(0, 4));
    int m = stoi(date.substr(5, 2));
    int d = stoi(date.substr(8, 2));
    long long day = y * 372LL + m * 31 + d;
    return day * 1440 + minutes;
}

string fmt(int m) {                      // 870 -> "14:30"
    char buf[8];
    snprintf(buf, sizeof buf, "%02d:%02d", m / 60, m % 60);
    return string(buf);
}

string toJson(const Event& e) {
    return "{\"id\":" + to_string(e.id) +
           ",\"name\":\"" + e.name + "\"" +
           ",\"club\":\"" + e.club + "\"" +
           ",\"venue\":\"" + e.venue + "\"" +
           ",\"date\":\"" + e.date + "\"" +
           ",\"start\":" + to_string(e.start) +
           ",\"end\":" + to_string(e.end) + "}";
}

// ---------- Clash check (uses the tree + the hash table) ----------
struct Clash { Event ev; string reason; };

vector<Clash> findClashes(const string& date, int s, int en,
                          const string& venue, const string& club) {
    vector<Clash> out;
    vector<int> ids = tree.findOverlaps(absTime(date, s), absTime(date, en));
    for (int id : ids) {
        Event* o = table.find(id);
        if (!o) continue;
        if (o->venue == venue)    out.push_back({*o, "Same venue"});
        else if (o->club == club) out.push_back({*o, "Same club"});
    }
    return out;
}

// ---------- Priority Queue (min-heap, lowest score first) ----------
struct Suggestion { int start, end, score; };

class MinHeap {
    vector<Suggestion> h;
public:
    bool empty() { return h.empty(); }
    void push(Suggestion s) {
        h.push_back(s);
        int i = (int)h.size() - 1;
        while (i > 0) {
            int p = (i - 1) / 2;
            if (h[p].score <= h[i].score) break;
            swap(h[p], h[i]);
            i = p;
        }
    }
    Suggestion pop() {
        Suggestion top = h[0];
        h[0] = h.back();
        h.pop_back();
        int i = 0, n = (int)h.size();
        while (true) {
            int l = 2 * i + 1, r = 2 * i + 2, m = i;
            if (l < n && h[l].score < h[m].score) m = l;
            if (r < n && h[r].score < h[m].score) m = r;
            if (m == i) break;
            swap(h[i], h[m]);
            i = m;
        }
        return top;
    }
};

string suggest(const Event& e) {
    int dur = e.end - e.start;
    MinHeap heap;
    for (int s = 8 * 60; s + dur <= 21 * 60; s += 30) {
        if (s == e.start) continue;
        if (!findClashes(e.date, s, s + dur, e.venue, e.club).empty()) continue;
        int score = abs(s - e.start);
        if (s < 9 * 60 || s + dur > 18 * 60) score += 120;
        heap.push({s, s + dur, score});
    }
    string out = "[";
    for (int k = 0; k < 3 && !heap.empty(); k++) {
        Suggestion sg = heap.pop();
        int diff = sg.start - e.start;
        string why = "No clash at " + e.venue + " or for " + e.club + ", " +
                     to_string(abs(diff)) + " min " + (diff < 0 ? "earlier" : "later") +
                     " than requested";
        if (k > 0) out += ",";
        out += "{\"start\":\"" + fmt(sg.start) + "\",\"end\":\"" + fmt(sg.end) +
               "\",\"reason\":\"" + why + "\"}";
    }
    out += "]";
    return out;
}
void saveEvent(const Event& e) {
    ofstream f("events.txt", ios::app);
    f << e.name << "|" << e.club << "|" << e.venue << "|" << e.date << "|"
      << e.start << "|" << e.end << "\n";
}

void loadEvents() {
    ifstream f("events.txt");
    string line;
    while (getline(f, line)) {
        vector<string> p;
        stringstream ss(line);
        string part;
        while (getline(ss, part, '|')) p.push_back(part);
        if (p.size() != 6) continue;
        Event e;
        e.id = nextId++;
        e.name = p[0]; e.club = p[1]; e.venue = p[2]; e.date = p[3];
        e.start = stoi(p[4]); e.end = stoi(p[5]);
        table.insert(e);
        tree.insert(e.id, absTime(e.date, e.start), absTime(e.date, e.end));
        recordAdded(e.start, e.end);
    }
}
int main() {
    httplib::Server svr;
    svr.set_mount_point("/", "./public");
    loadEvents();
    svr.set_default_headers({{"Access-Control-Allow-Origin", "*"}});

    svr.Get("/add", [](const httplib::Request& req, httplib::Response& res) {
        Event e;
        e.id    = 0;
        e.name  = req.get_param_value("name");
        e.club  = req.get_param_value("club");
        e.venue = req.get_param_value("venue");
        e.date  = req.get_param_value("date");
        e.start = toMinutes(req.get_param_value("start"));
        e.end   = toMinutes(req.get_param_value("end"));

        if (e.end <= e.start) {
            res.set_content("{\"added\":false,\"error\":\"End time must be after start time\",\"clashes\":[],\"suggestions\":[]}",
                            "application/json");
            return;
        }

        vector<Clash> clashes = findClashes(e.date, e.start, e.end, e.venue, e.club);

        if (clashes.empty()) {
            e.id = nextId++;
            table.insert(e);
            tree.insert(e.id, absTime(e.date, e.start), absTime(e.date, e.end));
            recordAdded(e.start, e.end);
            saveEvent(e);
            res.set_content("{\"added\":true,\"event\":" + toJson(e) + ",\"clashes\":[],\"suggestions\":[]}",
                            "application/json");
        } else {
            string cj = "[";
            recordClash(e.club, clashes[0].ev.club);
            for (size_t i = 0; i < clashes.size(); i++) {
                if (i > 0) cj += ",";
                cj += "{\"event\":" + toJson(clashes[i].ev) +
                      ",\"reason\":\"" + clashes[i].reason + "\"}";
            }
            cj += "]";
            string why = "Rejected: " + clashes[0].reason + " clash with '" +
                         clashes[0].ev.name + "' (" + fmt(clashes[0].ev.start) +
                         "-" + fmt(clashes[0].ev.end) + ")";
            res.set_content("{\"added\":false,\"event\":" + toJson(e) +
                            ",\"clashes\":" + cj +
                            ",\"explanation\":\"" + why + "\"" +
                            ",\"suggestions\":" + suggest(e) + "}",
                            "application/json");
        }
    });

    svr.Get("/events", [](const httplib::Request&, httplib::Response& res) {
        string out = "[";
        bool first = true;
        for (auto& e : table.all()) {
            if (!first) out += ",";
            out += toJson(e);
            first = false;
        }
        out += "]";
        res.set_content(out, "application/json");
    });

    svr.Get("/stats", [](const httplib::Request&, httplib::Response& res) {
    res.set_content(statsJson(), "application/json");
});
    cout << "CampusSync server running at http://localhost:8080" << endl;
    const char* p = getenv("PORT");
    int port = p ? atoi(p) : 8080;
    svr.listen("0.0.0.0", port);
}