#!/bin/bash

restart_server () {
   current_time=$(date)
   echo "$current_time restarting server"
   pm2 restart "/usr/local/bin/npm" --log-date-format 'DD-MM HH:mm:ss.SSS' --name "weare" -- start
}

run_as_sudo () {
  if [ $EUID != 0 ]; then
      sudo "$0" "$@"
      exit $?
  fi
}

query_server () {
  server_name="https://weconnect.ist.psu.edu:8443/"
  response=$(wget -q -O - "$server_name")
  response_lines=$(echo "$response" | wc -l )
  if [ "$response_lines" -le "1" ]; then
    restart_server
  fi
}

parse_args () {
  while getopts ":p:t:" opt; do
    case ${opt} in
      t )
        sleep_option=$OPTARG
        ;;
      \? )
        echo "Invalid option: $OPTARG" 1>&2
        ;;
      : )
        echo "Invalid option: $OPTARG requires an argument" 1>&2
        ;;
    esac
  done
}

parse_args "$@"
sleep_time=${sleep_option:-60}
echo "Checking for response every $sleep_time seconds"
while true; do
  query_server
  sleep "$sleep_time"
done
