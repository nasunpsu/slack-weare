#!/bin/bash
if [ $EUID != 0 ]; then
    sudo "$0" "$@"
    exit $?
fi
while inotifywait -q -q -e modify /root/.pm2/logs/weare-error.log; do
   last_line=$(tail -n 1 /root/.pm2/logs/weare-error.log)
   if [[ "$last_line" =~ .*loop.*watchers.* ]]; then
      current_time=$(date)
      echo "$current_time restarting server"
      sudo pm2 restart "/usr/local/bin/npm" --log-date-format 'DD-MM HH:mm:ss.SSS' --name "weare" -- start
   fi
done
