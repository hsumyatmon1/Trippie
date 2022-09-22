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
const FacebookStrategy = require("passport-facebook");
const findOrCreate = require("mongoose-findorcreate");
const axios = require("axios");
const http = require("https");
const mailchimp = require("@mailchimp/mailchimp_marketing");

global.locationID;
global.whereto;

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
        secret: "Our little secret.",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/Trippie", () => {
    console.log("MongoDB connected");
});

const tripplanSchema = new mongoose.Schema({
    destination: String,
    startDate: String,
    endDate: String,
    adult: Number,
    children: Number,
    currency: String,
    activities: Array,
});

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    plannedTrips: [tripplanSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const PlannedTrip = new mongoose.model("Planned_Trip", tripplanSchema);
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
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/myplans",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        function (accessToken, refreshToken, profile, cb) {
            console.log(profile);

            User.findOrCreate(
                {
                    googleId: profile.id,
                    username: profile.displayName,
                    email: profile.emails[0].value,
                },
                function (err, user) {
                    return cb(err, user);
                }
            );
        }
    )
);

passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: "http://localhost:3000/auth/facebook/callback",
        },
        function (accessToken, refreshToken, profile, cb) {
            console.log(profile);
            User.findOrCreate(
                {
                    facebookId: profile.id,
                    username: profile.displayName,
                },
                function (err, user) {
                    return cb(err, user);
                }
            );
        }
    )
);

app.get("/", function (req, res) {
    res.render("home");
});

app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
    "/auth/google/myplans",
    passport.authenticate("google", { failureRedirect: "/signin" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/myplans");
    }
);

app.get(
    "/login/facebook",
    passport.authenticate("facebook", {
        scope: ["email", "user_location"],
    })
);
app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", { failureRedirect: "/signin" }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/myplans");
    }
);

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
    PlannedTrip.find({}, function (err, foundPlans) {
        if (!err) {
            res.render("myplans", { foundPlans: foundPlans });
        } else {
            res.send(err);
        }
    });
});

app.get("/myplans/:planID", function (req, res) {
    const requestedID = req.params.planID;
    console.log(requestedID);

    PlannedTrip.findOne({ _id: requestedID }, function (err, foundID) {
        res.render("plan", { foundID: foundID });
    });
});

app.get("/planner", function (req, res) {
    res.render("planner");
});

app.post("/planner", function (req, res) {
    // req.params.destination = req.body.destination;
    // const filter = { _id: req.user.id };

    const startDate = req.body.startDate.toString();
    const endDate = req.body.endDate.toString();

    const newPlan = new PlannedTrip({
        destination: req.body.destination,
        startDate: startDate.slice(0, 10),
        endDate: endDate.slice(0, 10),
        adult: req.body.adult,
        children: req.body.children,
        currency: req.body.currency,
        activities: req.body.activities,
    });

    // const update = { plannedTrips: newPlan };

    // const doc = User.findOneAndUpdate(filter, update);
    // console.log(doc);
    newPlan.save();
    // User.save();
    res.redirect("/myplans");
});

app.get("/whereto", function (req, res) {
    res.render("whereto");
});

app.post("/whereto", function (req, res) {
    const whereto = encodeURIComponent(req.body.whereto);
    global.whereto = whereto;
    const http = require("https");

    const options = {
        method: "GET",
        hostname: "travel-advisor.p.rapidapi.com",
        port: null,
        path:
            "/locations/v2/auto-complete?query=" +
            whereto +
            "&lang=en_US&units=km",
        headers: {
            "X-RapidAPI-Key":
                "e0f666ff90mshe64fdb0fdf00c55p18c736jsncdcd259f958b",
            "X-RapidAPI-Host": "travel-advisor.p.rapidapi.com",
            useQueryString: true,
        },
    };

    const request = http.request(options, function (response) {
        const chunks = [];

        response.on("data", function (chunk) {
            chunks.push(chunk);
        });

        response.on("end", function () {
            const body = Buffer.concat(chunks);
            const stringData = body.toString();
            const jsData = JSON.parse(stringData);
            console.log(jsData);
            const locationId =
                jsData.data.Typeahead_autocomplete.results[0].detailsV2
                    .locationId;
            global.locationID = locationId;
            console.log("The user chose to go " + global.locationID);
        });
    });

    request.end();
    res.redirect("/services");
});

app.get("/services", function (req, res) {
    res.render("services");
});

app.get("/services/bookflights", function (req, res) {
    url = "https://www.tripadvisor.com/Flights-g" + global.locationID;
    res.redirect(url);
});

app.get("/services/book-accomodation", function (req, res) {
    url = "https://www.tripadvisor.com/Hotels-g" + global.locationID;
    res.redirect(url);
});

app.get("/services/covid-information", function (req, res) {
    url = abc;
    res.redirect(url);
});

app.get("/services/tour-guide", function (req, res) {
    tab = "tour_guides";
    url = "https://www.tourhq.com/" + whereto + "-tours-guide?tab=" + tab;
    res.redirect(url);
});

app.get("/services/things-to-do", function (req, res) {
    url = "https://www.tripadvisor.com/Attractions-g" + global.locationID;
    res.redirect(url);
});

app.get("/services/restaurants-recommendations", function (req, res) {
    url = "https://www.tripadvisor.com/Restaurants-g" + global.locationID;
    res.redirect(url);
});

app.get("/signin", function (req, res) {
    res.render("signin");
});

app.post("/logout", function (req, res, next) {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    });
});

app.listen(3000, function () {
    console.log("Server started on port 3000");
});
