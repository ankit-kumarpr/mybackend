const mongoose = require("mongoose");
const KeywordSuggestion = require("../models/KeywordSuggestion");
const VendorCategory = require("../models/vendorcategory");
const connectToDb = require("../config/db");

// Connect to database using existing connection
require("dotenv").config();
connectToDb();

// Initial keyword suggestions data
const initialSuggestions = {
  beauty: {
    beauty: [
      "best beauty salon",
      "beauty parlor",
      "beauty services",
      "professional beauty",
      "beauty treatment",
      "affordable beauty",
      "beauty specialist",
      "expert beauty",
      "beauty center",
      "quality beauty",
    ],
    salon: [
      "best salon",
      "salon services",
      "professional salon",
      "salon treatment",
      "affordable salon",
      "salon specialist",
      "expert salon",
      "salon center",
      "quality salon",
      "salon near me",
    ],
    hair: [
      "best hair salon",
      "hair cut",
      "hair styling",
      "hair treatment",
      "hair coloring",
      "hair spa",
      "hair care",
      "professional hair",
      "hair specialist",
      "hair services",
    ],
    makeup: [
      "best makeup artist",
      "makeup services",
      "bridal makeup",
      "party makeup",
      "makeup tutorial",
      "professional makeup",
      "makeup specialist",
      "makeup artist",
      "makeup studio",
      "makeup services",
    ],
  },
  education: {
    training: [
      "best training center",
      "training courses",
      "professional training",
      "training institute",
      "training classes",
      "expert training",
      "training academy",
      "certified training",
      "quality training",
      "training programs",
    ],
    course: [
      "best courses",
      "course classes",
      "professional course",
      "course institute",
      "course training",
      "expert course",
      "course academy",
      "certified course",
      "quality course",
      "course programs",
    ],
    react: [
      "best react training",
      "react course",
      "react classes",
      "professional react",
      "react institute",
      "expert react",
      "react coaching",
      "certified react",
      "react academy",
      "quality react",
    ],
    javascript: [
      "best javascript training",
      "javascript course",
      "javascript classes",
      "professional javascript",
      "javascript institute",
      "expert javascript",
      "javascript coaching",
      "certified javascript",
      "javascript academy",
      "quality javascript",
    ],
  },
  technology: {
    development: [
      "best development services",
      "development company",
      "professional development",
      "development solutions",
      "expert development",
      "development team",
      "quality development",
      "development experts",
      "reliable development",
      "development specialists",
    ],
    web: [
      "best web development",
      "web services",
      "professional web",
      "web solutions",
      "expert web",
      "web company",
      "quality web",
      "web experts",
      "reliable web",
      "web specialists",
    ],
    app: [
      "best app development",
      "app services",
      "professional app",
      "app solutions",
      "expert app",
      "app company",
      "quality app",
      "app experts",
      "reliable app",
      "app specialists",
    ],
  },
  healthcare: {
    clinic: [
      "best clinic",
      "clinic services",
      "professional clinic",
      "clinic treatment",
      "expert clinic",
      "clinic specialist",
      "quality clinic",
      "clinic care",
      "reliable clinic",
      "clinic near me",
    ],
    doctor: [
      "best doctor",
      "doctor services",
      "professional doctor",
      "doctor consultation",
      "expert doctor",
      "doctor specialist",
      "quality doctor",
      "doctor care",
      "reliable doctor",
      "doctor near me",
    ],
    treatment: [
      "best treatment",
      "treatment services",
      "professional treatment",
      "treatment center",
      "expert treatment",
      "treatment specialist",
      "quality treatment",
      "treatment care",
      "reliable treatment",
      "treatment options",
    ],
  },
  food: {
    restaurant: [
      "best restaurant",
      "restaurant food",
      "restaurant delivery",
      "delicious restaurant",
      "restaurant cuisine",
      "fresh restaurant",
      "restaurant catering",
      "quality restaurant",
      "restaurant menu",
      "authentic restaurant",
    ],
    food: [
      "best food",
      "food delivery",
      "delicious food",
      "fresh food",
      "food catering",
      "quality food",
      "food menu",
      "authentic food",
      "food services",
      "food near me",
    ],
    pizza: [
      "best pizza",
      "pizza delivery",
      "delicious pizza",
      "fresh pizza",
      "pizza restaurant",
      "quality pizza",
      "pizza menu",
      "authentic pizza",
      "pizza services",
      "pizza near me",
    ],
  },
};

async function populateKeywordSuggestions() {
  try {
    console.log("Starting to populate keyword suggestions...");

    // Get all categories
    const categories = await VendorCategory.find({});
    console.log(`Found ${categories.length} categories`);

    for (const category of categories) {
      const categoryName = category.category_name.toLowerCase();
      console.log(`Processing category: ${categoryName}`);

      if (initialSuggestions[categoryName]) {
        for (const [baseKeyword, suggestions] of Object.entries(
          initialSuggestions[categoryName]
        )) {
          // Check if suggestion already exists
          const existingSuggestion = await KeywordSuggestion.findOne({
            category_id: category._id,
            base_keyword: baseKeyword,
          });

          if (!existingSuggestion) {
            const suggestionData = {
              category_id: category._id,
              base_keyword: baseKeyword,
              suggestions: suggestions.map((keyword) => ({
                keyword: keyword,
                popularity: Math.floor(Math.random() * 10) + 1,
                usage_count: Math.floor(Math.random() * 50),
              })),
            };

            await KeywordSuggestion.create(suggestionData);
            console.log(
              `Created suggestions for ${baseKeyword} in ${categoryName}`
            );
          } else {
            console.log(
              `Suggestions for ${baseKeyword} in ${categoryName} already exist`
            );
          }
        }
      }
    }

    console.log("Keyword suggestions populated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error populating keyword suggestions:", error);
    process.exit(1);
  }
}

// Run the script
populateKeywordSuggestions();
