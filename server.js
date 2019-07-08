require('./sync');
require('./helpers/genSecrets');

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').createServer(app);
const cors = require('cors');
const io = require('socket.io')(http);
require('dotenv').config();

const clientURL = ( process.env.DATABASE_URL ? 'spaceplanner3d.herokuapp.com' : 'localhost:3000' );
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors({
  origin: ( process.env.DATABASE_URL ? [`https://${clientURL}`,`http://${clientURL}`] : `http://${clientURL}` ),
  methods: ['GET','POST','PATCH','DELETE','PUT','OPTIONS','HEAD'],
  allowedHeaders: 'Content-Type,Authorization,Content-Length,X-Requested-With,X-Prototype-Version,Origin,Allow,*',
  credentials: true,
  maxAge: 7200000,
  preflightContinue: false
}));

// callbacks
const socketCallback = require('./callbacks/socketCallback');
const createAccountCallback = require('./callbacks/createAccountCallback');
const loginCallback = require('./callbacks/loginCallback');
const loggedinCallback = require('./callbacks/loggedinCallback');
const logoutCallback = require('./callbacks/logoutCallback');
const usernameExistsCallback = require('./callbacks/usernameExistsCallback');
const deleteUserCallback = require('./callbacks/deleteUserCallback');
const changePasswordCallback = require('./callbacks/changePasswordCallback');
const getRoomsCallback = require('./callbacks/getRoomsCallback');
const postRoomsCallback = require('./callbacks/postRoomsCallback');
const getRoomCallback = require('./callbacks/getRoomCallback');
const deleteRoomCallback = require('./callbacks/deleteRoomCallback');
const patchRoomCallback = require('./callbacks/patchRoomCallback');
const isOwnerCallback = require('./callbacks/isOwnerCallback');
const getRoomFurnishingsCallback = require('./callbacks/getRoomFurnishingsCallback');
const patchFurnishingCallback = require('./callbacks/patchFurnishingCallback');
const postFurnishingCallback = require('./callbacks/postFurnishingCallback');
const deleteFurnishingCallback = require('./callbacks/deleteFurnishingCallback');
const postUserRoomCallback = require('./callbacks/postUserRoomCallback');
const patchUserRoomCallback = require('./callbacks/patchUserRoomCallback');
const deleteUserRoomCallback = require('./callbacks/deleteUserRoomCallback');
const getColorsCallback = require('./callbacks/getColorsCallback');
const getColorByNameCallback = require('./callbacks/getColorByNameCallback');

// socket.io
io.on("connection", socketCallback);

// AUTH

// create account (bcrypt)
app.post('/api/users', createAccountCallback);

// login
app.post('/api/login', loginCallback);

// check whether we are logged in
app.get("/api/loggedin", loggedinCallback);

// logout from app
app.delete("/api/login", logoutCallback);

// find out if username is taken
app.get("/api/:username/exists", usernameExistsCallback);

// delete a user (must be logged in)
app.delete("/api/users/:username", deleteUserCallback);

// change user's password
app.patch('/api/users/:username/password', changePasswordCallback);

// API ROUTES

// get rooms for particular user
app.get("/api/users/:username/rooms", getRoomsCallback );

// post room
app.post("/api/rooms", postRoomsCallback );

// patch room
app.patch("/api/rooms/:id", patchRoomCallback);

// delete room (owner only)
app.delete("/api/rooms/:id", deleteRoomCallback);

// get room (collaborators only)
app.get("/api/rooms/:id", getRoomCallback);

// determine whether user is owner of room
app.get("/api/rooms/:id/isOwner", isOwnerCallback);

// get room furnishings (collaborators only)
app.get("/api/rooms/:id/furnishings", getRoomFurnishingsCallback);

// post furnishing
app.post("/api/furnishings", postFurnishingCallback);

// patch furnishing
app.patch("/api/furnishings/:id", patchFurnishingCallback);

// delete furnishing
app.delete("/api/furnishings/:id", deleteFurnishingCallback);

// post UserRoom (=== add collaborator) ... owner only
app.post("/api/UserRooms", postUserRoomCallback);

// patch UserRoom (=> confirm collaborator)
app.patch("/api/UserRooms", patchUserRoomCallback);

// delete UserRoom (leave room, only if *not* owner)
app.delete("/api/UserRooms", deleteUserRoomCallback);

// get colors (no auth)
app.get("/api/colors", getColorsCallback);

// get color by name (no auth)
app.get("/api/colors/:colorName", getColorByNameCallback);

// LISTEN
http.listen(process.env.PORT || 8000);
