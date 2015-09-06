grep $1 history.csv | cut -d ";" -f2 | echo "@$(cat -)" | xargs date -d
