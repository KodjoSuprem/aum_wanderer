import datetime

with open(r"C:\SSD\DEV\phantomjs\history.csv") as fd , open(r"C:\SSD\DEV\phantomjs\history_date.csv", 'w') as output:

        print( "running")

        duplicates = dict();
        i=0
        for l in fd :
            id = l.split(";")[0]
          #  if id  not in duplicates:
            duplicates[id] = True
            tt = (l.split(";"))[1]
            ttDate = datetime.datetime.fromtimestamp(int(tt)).strftime('%d/%m/%Y')
            ttDateTime = datetime.datetime.fromtimestamp(int(tt)).strftime('%H:%M:%S')
            output.write( id + ";" + ttDate + ";" + ttDateTime + "\n")
            i+=1
            
        print("done : " + str(i))


