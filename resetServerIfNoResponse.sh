#!/bin/bash

restart_server () {
   current_time=$(date)
   echo "$current_time restarting server"
   sudo pm2 restart "/usr/local/bin/npm" --log-date-format 'DD-MM HH:mm:ss.SSS' --name "weare" -- start
}

run_as_sudo () {
  if [ $EUID != 0 ]; then
      sudo "$0" "$@"
      exit $?
  fi
}

query_server () {
  server_name="http://localhost:$1"
  response=$(wget -q -O - "$server_name")
  response_lines=$(echo "$response" | wc -l )
  if [ "$response_lines" -le "1" ]; then
    restart_server
  fi
}

parse_args () {
  while getopts ":p:t:" opt; do
    case ${opt} in
      p )
        port_option=$OPTARG
        ;;
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

run_as_sudo "$@"
parse_args "$@"
port=${port_option:-8080}
sleep_time=${sleep_option:-60}
echo "Querying for response on port $port"
echo "Checking for response every $sleep_time seconds"
while true; do
  query_server "$port"
  sleep "$sleep_time"
done
