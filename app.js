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
const http = require("https");

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

mongoose.connect(
    "mongodb+srv://" + process.env.MongoDBconnect + "/Trippie",
    () => {
        console.log("MongoDB connected");
    }
);

app.use(function (req, res, next) {
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});

const itemSchema = new mongoose.Schema({
    name: String,
    url: String,
});

const tripplanSchema = new mongoose.Schema({
    userID: String,
    destination: String,
    locationID: Number,
    startDate: String,
    endDate: String,
    adult: Number,
    children: Number,
    currency: String,
    activities: Array,
    checklistdefault: [itemSchema],
    checklistdynamic: [itemSchema],
});

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Item = new mongoose.model("Item", itemSchema);
const PlannedTrip = new mongoose.model("Planned_Trip", tripplanSchema);
const User = new mongoose.model("User", userSchema);

const item1 = new Item({
    name: "Check Visa Information",
    url: "https://www.ivisa.com/",
});

const item2 = new Item({
    name: "Check Covid Information",
    url: "https://www.booking.com/covid-19.html",
});

const item3 = new Item({
    name: "Buy Travel Insurance",
    url: "https://www.worldnomads.com/",
});

const item4 = new Item({
    name: "Book Flights",
    url: "https://www.tripadvisor.com/Flights-g",
});

const item5 = new Item({
    name: "Book Accomodation",
    url: "https://www.tripadvisor.com/Hotels-g",
});

const item6 = new Item({
    name: "Check Out The Places To Visit",
    url: "https://www.tripadvisor.com/Attractions-g",
});

const item7 = new Item({
    name: "Check Out The Restaurants Recommendations",
    url: "https://www.tripadvisor.com/Restaurants-g",
});

const defaultItems = [item1, item2, item3];
const dynamicItems = [item4, item5, item6, item7];

global.locationID;
global.whereto;

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
            callbackURL:
                "https://young-bayou-18229.herokuapp.com/auth/google/myplans",
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
            callbackURL:
                "https://young-bayou-18229.herokuapp.com/auth/facebook/callback",
        },
        function (accessToken, refreshToken, profile, cb) {
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
        // Successful authentication, redirect to myplans.
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
        // Successful authentication, redirect to myplans.
        res.redirect("/myplans");
    }
);

app.get("/FAQs", function (req, res) {
    res.render("FAQs");
});

app.get("/myplans", function (req, res) {
    if (req.isAuthenticated()) {
        PlannedTrip.find({ userID: req.user.id }, function (err, foundPlans) {
            if (!err) {
                res.render("myplans", { foundPlans: foundPlans });
            } else {
                res.send(err);
            }
        });
    } else {
        res.render("myplans", { foundPlans: [] });
    }
});

app.get("/myplans/:planID", function (req, res) {
    PlannedTrip.findOne({ _id: req.params.planID }, function (err, foundID) {
        res.render("plan", { foundID: foundID });
    });
});

app.post("/myplans/:planID/delete", function (req, res) {
    PlannedTrip.deleteOne({ _id: req.params.planID }, function (err) {
        console.log("The plan has been deleted.");
        res.redirect("/myplans");
    });
});

app.post("/checkeddefaultitemdelete", function (req, res) {
    const checkedItemID = req.body.currentCheckbox;
    const checkedPlanID = req.body.checkedPlanID;

    PlannedTrip.findOneAndUpdate(
        { _id: checkedPlanID },
        { $pull: { checklistdefault: { _id: checkedItemID } } },
        function (err, foundList) {
            if (!err) {
                console.log("Successfully removed.");
                res.redirect("/myplans/" + checkedPlanID);
            }
        }
    );
});

app.post("/checkeddynamicitemdelete", function (req, res) {
    const checkedItemID = req.body.currentCheckbox;
    const checkedPlanID = req.body.checkedPlanID;

    PlannedTrip.findOneAndUpdate(
        { _id: checkedPlanID },
        { $pull: { checklistdynamic: { _id: checkedItemID } } },
        function (err, foundList) {
            if (!err) {
                console.log("Successfully removed.");
                res.redirect("/myplans/" + checkedPlanID);
            }
        }
    );
});

app.get("/planner", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("planner");
    } else {
        res.redirect("/signin");
    }
});

app.post("/planner", function (req, res) {
    const startDate = req.body.startDate.toString();
    const endDate = req.body.endDate.toString();
    const destination = encodeURIComponent(req.body.destination);

    const options = {
        method: "GET",
        hostname: "travel-advisor.p.rapidapi.com",
        port: null,
        path:
            "/locations/v2/auto-complete?query=" +
            destination +
            "&lang=en_US&units=km",
        headers: {
            "X-RapidAPI-Key": process.env.XRapidAPIKey,
            "X-RapidAPI-Host": process.env.XRapidAPIHost,
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
            const locationID =
                jsData.data.Typeahead_autocomplete.results[0].detailsV2
                    .locationId;
            global.locationID = locationID;
            console.log("In planner, the Location ID is " + locationID);
            console.log(
                "From planner, the user chose to go to " + global.locationID
            );
        });
    });

    request.end();

    setTimeout(newPlan, 2000);

    function newPlan() {
        const newPlan = new PlannedTrip({
            userID: req.user.id,
            destination: req.body.destination,
            locationID: global.locationID,
            startDate: startDate.slice(0, 10),
            endDate: endDate.slice(0, 10),
            adult: req.body.adult,
            children: req.body.children,
            currency: req.body.currency,
            activities: req.body.activities,
            checklistdefault: defaultItems,
            checklistdynamic: dynamicItems,
        });

        newPlan.save();
        res.redirect("/myplans");
    }
});

app.get("/whereto", function (req, res) {
    global.locationID = null;
    res.render("whereto");
});

app.post("/whereto", function (req, res, next) {
    const whereto = encodeURIComponent(req.body.whereto);
    global.whereto = whereto;

    const options = {
        method: "GET",
        hostname: "travel-advisor.p.rapidapi.com",
        port: null,
        path:
            "/locations/v2/auto-complete?query=" +
            whereto +
            "&lang=en_US&units=km",
        headers: {
            "X-RapidAPI-Key": process.env.XRapidAPIKey,
            "X-RapidAPI-Host": process.env.XRapidAPIHost,
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
            const locationID =
                jsData.data.Typeahead_autocomplete.results[0].detailsV2
                    .locationId;
            global.locationID = locationID;
            console.log("In whereto, the Location ID is " + locationID);
            console.log(
                "From whereto, the user chose to go to " + global.locationID
            );
        });
    });

    request.end();

    setTimeout(res.redirect("/services"), 2000);
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

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}

app.listen(port, function () {
    console.log("Server has started.");
});
