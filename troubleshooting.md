## Start MongoDB Locally (On Dev Machine)

I followed this video https://www.youtube.com/watch?v=Ld88h-68Wbc&list=LL&index=1 to get MongoDB installed.
Downloaded Community server into the folder ~/Documents/mongo_app
Created an empty folder ~/Documents/mongo_databases

```shell
 $ cd ~/Documents/mongo_app/bin
 $  ./mongod --dbpath ~/Documents/mongo_databases # If the folder is empty the initial db files will be created here. Otherwise, the existing db files will be used.
```
