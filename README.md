# CampusSync: Event Clash Detector

**Course:** Data Structures Mini Project, MANIT Bhopal
**Members:**
- Sneha M S, CSE-2, Scholar No. 25112011254
- Krishna Upadhyay, CSE-2, Scholar No. 25112011236

**Live demo:** https://campussync-sguu.onrender.com

## What it does
CampusSync lets clubs register events (name, club, venue, date, start and
end time). It detects clashes (time overlap AND same venue or same club),
explains why an event was rejected, and suggests the 3 best alternative
time slots. It also shows a registered-events list and conflict analytics.
Date and time are set with alarm-style scroll wheels.

## Data structures (all implemented from scratch in C++)
Data structure	Operation	Complexity
Hash table (chaining)	Search event by ID	O(1) average, O(n) worst case
Interval tree	Insert interval	O(h)
Interval tree	Find overlapping intervals	O(n) worst case
Min-heap	Insert suggestion	O(log n)
Min-heap	Extract minimum	O(log n)

An event is considered conflicting when its time interval overlaps with an existing event AND either its venue or club matches. The interval tree first identifies overlapping events, while the hash table retrieves their complete details using event IDs.

Alternative slots are generated at 30-minute intervals. Each candidate retains the original event duration and is checked against existing events. Valid candidates are assigned scores based on their time difference from the requested slot and a penalty for scheduling outside preferred operating hours. A custom min-heap extracts the three lowest-scoring suggestions.

Scoring rule: minutes away from the requested time, plus a penalty of 120
for slots outside 9:00 AM to 6:00 PM. Lower score = better suggestion.
Time ranges are [start, end), so 2-3 PM and 3-4 PM do not clash.

## Tech stack
- Backend: C++17 with the cpp-httplib header for the local web server
- Storage: events.txt (file handling, reloaded at startup)
- Frontend: HTML, CSS, JavaScript (in the `public` folder)

## How to run locally (Windows)
1. Compile: `g++ main.cpp -o server.exe -std=c++17 -lws2_32 -lwsock32`
2. Run: `.\server.exe`
3. Open http://localhost:8080 in a browser

## Known limitation
The interval tree is not self-balancing, so worst-case operations can take O(n) time. An AVL-based interval tree could improve performance.
Events are stored in a local text file. A database could provide more robust persistence and data management.
The current system assumes valid date and time inputs; stronger input validation can improve reliability.
