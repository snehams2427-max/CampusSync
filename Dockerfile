FROM gcc:13
WORKDIR /app
COPY . .
RUN g++ main.cpp -o server -std=c++17 -O2 -pthread
CMD ["./server"]