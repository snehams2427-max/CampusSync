#pragma once
#include <string>
#include <vector>
using namespace std;

struct ClubCount { string club; int count; };

int totalAdded = 0;
int totalClashes = 0;
int hourLoad[24] = {0};          // how many events cover each hour
vector<ClubCount> clubClashes;   // clash count per club

void bumpClub(const string& club) {
    for (auto& c : clubClashes)
        if (c.club == club) { c.count++; return; }
    clubClashes.push_back({club, 1});
}

void recordAdded(int start, int end) {
    totalAdded++;
    for (int h = start / 60; h * 60 < end; h++) hourLoad[h]++;
}

void recordClash(const string& newClub, const string& oldClub) {
    totalClashes++;
    bumpClub(newClub);
    if (oldClub != newClub) bumpClub(oldClub);
}

string statsJson() {
    // sort clubs, most clashes first (bubble sort)
    for (size_t i = 0; i < clubClashes.size(); i++)
        for (size_t j = 0; j + 1 < clubClashes.size() - i; j++)
            if (clubClashes[j].count < clubClashes[j + 1].count)
                swap(clubClashes[j], clubClashes[j + 1]);

    string out = "{\"added\":" + to_string(totalAdded) +
                 ",\"clashes\":" + to_string(totalClashes) + ",\"hours\":[";
    for (int h = 0; h < 24; h++) {
        if (h > 0) out += ",";
        out += to_string(hourLoad[h]);
    }
    out += "],\"clubs\":[";
    for (size_t i = 0; i < clubClashes.size(); i++) {
        if (i > 0) out += ",";
        out += "{\"club\":\"" + clubClashes[i].club + "\",\"count\":" +
               to_string(clubClashes[i].count) + "}";
    }
    out += "]}";
    return out;
}