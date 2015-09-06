username=miniscalope@gmail.com
password=pCd14sVk

mkdir -p areas_log
if [[ -z "$2" ]]; then
    phantomjs aum_wanderer.js $username $password "$1"
else
    #remove useless entries from ville database
    grep -RohP "ville not found \K\\w+\\b" areas_log/* | sed ':a;N;$!ba;s/\n/;|/g' | xargs -i grep -Ev "{}" villes_france_2.csv > villes_france_2_exist.csv

    grep "$1" villes_france_2_exist.csv | while IFS=";" read -r dep ville ville_lowercase ville_full code hab; do
        #ls . | tee areas_log/${dep}_${ville_lowercase// /_}.txt
        phantomjs aum_wanderer.js $username $password "$2 $ville" "$ville" | tee areas_log/${dep}_${ville_lowercase// /_}.txt 
    done
fi
    
