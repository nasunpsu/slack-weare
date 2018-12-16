require('dotenv').config();
const SlackClient = require('@slack/client').WebClient;
const fs = require('fs');
const async = require('async');
const MongoClient = require('mongodb').MongoClient;

const DB = null;