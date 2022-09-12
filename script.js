//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.use(
    session({
        secret: "Trippie day!",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/Trippie");
// mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/myplans",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        function (accessToken, refreshToken, profile, cb) {
            console.log(profile);

            User.findOrCreate({ googleId: profile.id }, function (err, user) {
                return cb(err, user);
            });
        }
    )
);

app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get(
    "/auth/google/",
    passport.authenticate("google", { failureRedirect: "/signin" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/");
    }
);

// const Post = mongoose.model("Post", postSchema);

// app.get("/", function (req, res) {
//     Post.find({}, function (err, foundPosts) {
//         if (!err) {
//             res.render("home", {
//                 startingContent: homeStartingContent,
//                 posts: foundPosts,
//             });
//         }
//     });
// });

// app.get("/about", function (req, res) {
//     res.render("about", { aboutContent: aboutContent });
// });

// app.get("/contact", function (req, res) {
//     res.render("contact", { contactContent: contactContent });
// });

// app.get("/compose", function (req, res) {
//     res.render("compose");
// });

// app.post("/compose", function (req, res) {
//     const newTitle = req.body.postTitle;
//     const newContent = req.body.postBody;

//     const newPost = new Post({
//         title: newTitle,
//         content: newContent,
//     });

//     newPost.save();
//     res.redirect("/");
// });

// app.get("/posts/:postID", function (req, res) {
//     const requestedID = req.params.postID;

//     Post.findOne({ _id: requestedID }, function (err, foundID) {
//         res.render("post", {
//             title: foundID.title,
//             content: foundID.content,
//         });
//     });
// });

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/destinations", function (req, res) {
    res.render("destinations");
});

app.get("/FAQs", function (req, res) {
    res.render("FAQs");
});

app.get("/favourites", function (req, res) {
    res.render("favourites");
});

app.get("/myplans", function (req, res) {
    res.render("myplans");
});

app.get("/planner", function (req, res) {
    res.render("planner");
});

app.get("/services", function (req, res) {
    res.render("services");
});

app.get("/signin", function (req, res) {
    res.render("signin");
});

app.get("/signup", function (req, res) {
    res.render("signup");
});

app.listen(3000, function () {
    console.log("Server started on port 3000");
});
