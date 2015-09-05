username=miniscalope@gmail.com
password=pCd14sVk

mkdir -p areas_log
if [[ -z "$2" ]]; then
    phantomjs aum_wanderer.js $username $password $1
else
    grep "$1" villes_france_2.csv | while IFS=";" read -r dep ville ville_lowercase ville_full code hab; do
        #ls . | tee areas_log/${dep}_${ville_lowercase// /_}.txt
        phantomjs aum_wanderer.js $username $password "$1 $ville" $ville | tee areas_log/${dep}_${ville_lowercase// /_}.txt 
    done
fi
    
