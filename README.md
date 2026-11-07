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
| Data structure | Used for | Complexity |
|---|---|---|
| Hash table (chaining) | Find an event by ID | O(1) average |
| Interval tree | Find events with overlapping time ranges | O(log n + k) typical |
| Min-heap (priority queue) | Rank alternative slots by score | O(log n) push/pop |

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
The interval tree is not self-balancing; an AVL-based version would
guarantee O(log n).
