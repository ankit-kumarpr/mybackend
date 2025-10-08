const Service = require("../models/Service");
const User = require("../models/User");
const VendorCategory = require("../models/vendorcategory");
const VendorKyc = require("../models/vendorKyc");
const mongoose = require("mongoose");
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: "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"
});

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to validate price
const isValidPrice = (price) => {
  return typeof price === "number" && price >= 0;
};

// Helper function to validate keywords
const validateKeywords = (keywords) => {
  if (!Array.isArray(keywords) || keywords.length < 10) {
    return false;
  }

  return keywords.every(
    (keyword) =>
      typeof keyword === "string" &&
      keyword.trim().length >= 2 &&
      keyword.trim().length <= 50
  );
};

// Test endpoint to check if server is working
const testEndpoint = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Server is working!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get SEO-friendly keyword suggestions using OpenAI
const getKeywordSuggestions = async (req, res) => {
  try {
    console.log('Keyword suggestions request received:', {
      body: req.body,
      headers: req.headers,
      method: req.method
    });

    const { query, vendorId } = req.body;

    if (!query || query.trim().length < 2) {
      console.log('Invalid query:', query);
      return res.status(400).json({
        success: false,
        message: "Service name must be at least 2 characters long",
      });
    }

    console.log('Processing keyword suggestions for:', query);

    // Get vendor's location from KYC
    let vendorLocation = 'India'; // Default location
    let vendorCity = '';
    let vendorState = '';
    let vendorBusinessName = '';
    let vendorCategory = '';

    if (vendorId) {
      try {
        const vendorKyc = await VendorKyc.findOne({ vendor_id: vendorId });
        if (vendorKyc && vendorKyc.business_details) {
          vendorCity = vendorKyc.business_details.city || '';
          vendorState = vendorKyc.business_details.state || '';
          vendorBusinessName = vendorKyc.business_details.business_name || '';
          vendorCategory = vendorKyc.business_details.category || '';
          
          if (vendorCity) {
            vendorLocation = vendorCity;
            if (vendorState) {
              vendorLocation = `${vendorCity}, ${vendorState}`;
            }
          }
        }
      } catch (kycError) {
        console.log('Error fetching vendor KYC:', kycError);
      }
    }

    console.log('Vendor location details:', {
      city: vendorCity,
      state: vendorState,
      location: vendorLocation,
      businessName: vendorBusinessName,
      category: vendorCategory
    });

    const prompt = `Generate 200+ comprehensive SEO-friendly keywords for the service: "${query}" that will rank FAST on Google. 

    Requirements for FAST RANKING:
    1. Create LONG-TAIL keywords (minimum 15-20 characters each)
    2. Include SERVICE-SPECIFIC VARIATIONS for "${query}" (e.g., if query is "haircut", include "hair cut", "hair cutting", "hair styling", "hair trimming", "hair design", etc.)
    3. Include MULTIPLE SEO STRATEGIES for fast ranking:
    
    A) SERVICE TYPE VARIATIONS (High Priority):
    - Create variations of "${query}": different ways people search for this service
    - Include related services: complementary services, similar services, alternative services
    - Include service categories: men's, women's, kids', unisex, family, couple
    - Include service styles: traditional, modern, classic, trendy, contemporary
    - Include service methods: professional, home service, mobile, online consultation
    
    B) PRICE-BASED KEYWORDS (Medium Competition):
    - Include "affordable", "cheap", "budget-friendly", "low cost", "pocket-friendly"
    - Include "premium", "luxury", "high-end", "expensive", "costly"
    - Include "best price", "competitive rates", "value for money", "reasonable price"
    - Include specific price ranges: "under 1000", "under 5000", "starting from", "from 500"
    
    C) EXPERTISE-BASED KEYWORDS (Authority Building):
    - Include "expert", "professional", "certified", "licensed", "qualified", "experienced"
    - Include "specialist", "master", "skilled", "trained", "accredited"
    - Include "award-winning", "recognized", "reputed", "trusted", "reliable"
    - Include years of experience: "10 years experience", "15+ years", "decade of experience"
    
    D) SERVICE-SPECIFIC KEYWORDS (Intent Matching):
    - Include "booking", "appointment", "consultation", "treatment", "therapy", "session"
    - Include "home service", "at home", "doorstep", "pickup service", "mobile service"
    - Include "same day", "instant", "quick", "emergency", "urgent", "immediate"
    - Include "24/7", "round the clock", "anytime", "flexible timing", "weekend service"
    
    E) BUSINESS TYPE KEYWORDS (Category Targeting):
    - Include "salon", "parlor", "center", "studio", "clinic", "institute", "academy"
    - Include "spa", "beauty lounge", "wellness center", "treatment center"
    - Include "boutique", "shop", "store", "outlet", "branch", "franchise"
    
    F) REVIEW/RATING KEYWORDS (Social Proof):
    - Include "5-star", "highly rated", "top-rated", "best rated", "highest rated"
    - Include "customer reviews", "client feedback", "testimonials", "recommended"
    - Include "popular", "famous", "well-known", "established", "leading"
    
    G) COMPARISON KEYWORDS (Competitive Advantage):
    - Include "best", "top", "leading", "number 1", "first choice", "preferred"
    - Include "vs", "compared to", "better than", "superior to", "outperforms"
    - Include "alternative to", "instead of", "replacement for", "substitute for"
    
    H) SEASONAL/TIMING KEYWORDS (Trending):
    - Include "2024", "latest", "new", "modern", "contemporary", "trending"
    - Include "festival", "wedding season", "party", "special occasion", "event"
    - Include "summer", "winter", "monsoon", "seasonal", "holiday special"
    
    I) PROBLEM-SOLVING KEYWORDS (Pain Points):
    - Include "solution for", "fix for", "treatment for", "cure for", "remedy for"
    - Include specific problems related to "${query}" (e.g., hair loss, skin issues, etc.)
    - Include "emergency", "urgent", "quick fix", "instant solution", "immediate relief"
    
    J) DEMOGRAPHIC-SPECIFIC KEYWORDS:
    - Include "for men", "for women", "for kids", "for seniors", "for teens"
    - Include "unisex", "family-friendly", "couple service", "group booking"
    
    K) TECHNOLOGY/MODERN KEYWORDS:
    - Include "digital", "online", "app-based", "tech-enabled", "modern techniques"
    - Include "AI-powered", "advanced", "innovative", "cutting-edge"
    
    Format: Return ONLY the keywords, one per line, without numbering, bullet points, or explanations.
    Each keyword should be 15-50 characters long and highly specific for FAST SEO ranking.
    Mix all strategies above to create diverse, high-ranking keywords.
    Include maximum variations of "${query}" and related services.

    Examples of FAST-RANKING keywords for "${query}":
    - best ${query} near me under 2000
    - top-rated ${query} expert with 10 years experience
    - affordable ${query} same day service
    - certified ${query} specialist home service
    - 5-star ${query} budget-friendly booking
    - professional ${query} emergency service
    - luxury ${query} center premium pricing
    - experienced ${query} artist customer reviews
    - instant ${query} 24/7 available
    - award-winning ${query} competitive rates
    - modern ${query} techniques latest 2024
    - family-friendly ${query} for all ages
    - mobile ${query} service doorstep delivery`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.8
    });

    const suggestionsText = response.choices[0].message.content;
    const suggestions = suggestionsText
      .split('\n')
      .map(suggestion => suggestion.trim())
      .filter(suggestion => 
        suggestion.length >= 15 && 
        suggestion.length <= 50 && 
        suggestion.length > 0 &&
        !suggestion.match(/^\d+\./) && // Remove numbered items
        !suggestion.includes('Example') && // Remove example text
        !suggestion.includes('Format:') && // Remove format instructions
        !suggestion.includes('Requirements:') // Remove requirements text
      )
      .slice(0, 200); // Limit to 200 suggestions

    console.log('Generated suggestions count:', suggestions.length);
    console.log('Sample suggestions:', suggestions.slice(0, 5));

    res.status(200).json({
      success: true,
      message: `SEO-friendly keyword suggestions generated for ${vendorLocation}`,
      suggestions: suggestions,
      count: suggestions.length,
      location: vendorLocation,
      city: vendorCity
    });

  } catch (error) {
    console.error("Get keyword suggestions error:", error);
    
    // Enhanced fallback suggestions when OpenAI API fails
    const serviceName = req.body.query || 'service';
    const vendorId = req.body.vendorId;
    let vendorLocation = 'India';
    let vendorCity = '';

    // Try to get vendor location for fallback
    if (vendorId && vendorId !== null && vendorId !== undefined) {
      try {
        const vendorKyc = await VendorKyc.findOne({ vendor_id: vendorId });
        if (vendorKyc && vendorKyc.business_details) {
          vendorCity = vendorKyc.business_details.city || '';
          vendorState = vendorKyc.business_details.state || '';
          if (vendorCity) {
            vendorLocation = vendorCity;
            if (vendorState) {
              vendorLocation = `${vendorCity}, ${vendorState}`;
            }
          }
        }
      } catch (kycError) {
        console.log('Error fetching vendor KYC for fallback:', kycError);
      }
    }

    // Multiple SEO strategies for fast ranking with service variations
    const serviceVariations = [
      serviceName.toLowerCase(),
      serviceName.toLowerCase().replace(/\s+/g, ' '), // Normalize spaces
      serviceName.toLowerCase().replace(/\s+/g, ' '), // No hyphenated version
      serviceName.toLowerCase().replace(/\s+/g, ''), // No spaces version
    ];
    
    // Add common service variations based on the service name
    if (serviceName.toLowerCase().includes('hair')) {
      serviceVariations.push('hair cut', 'hair cutting', 'hair styling', 'hair trimming', 'hair design', 'hair treatment', 'hair care', 'hair service');
    }
    if (serviceName.toLowerCase().includes('makeup')) {
      serviceVariations.push('make up', 'makeup artist', 'cosmetics', 'beauty makeup', 'bridal makeup', 'party makeup', 'makeup service');
    }
    if (serviceName.toLowerCase().includes('beauty')) {
      serviceVariations.push('beauty treatment', 'beauty service', 'beauty care', 'beauty parlor', 'beauty salon', 'beauty center');
    }
    if (serviceName.toLowerCase().includes('massage')) {
      serviceVariations.push('massage therapy', 'body massage', 'relaxation massage', 'therapeutic massage', 'spa massage');
    }
    if (serviceName.toLowerCase().includes('facial')) {
      serviceVariations.push('face treatment', 'skin treatment', 'facial treatment', 'beauty facial', 'glow facial');
    }
    if (serviceName.toLowerCase().includes('nail')) {
      serviceVariations.push('nail art', 'nail design', 'nail care', 'nail treatment', 'manicure', 'pedicure');
    }
    if (serviceName.toLowerCase().includes('spa')) {
      serviceVariations.push('spa treatment', 'spa therapy', 'spa service', 'wellness spa', 'luxury spa');
    }
    if (serviceName.toLowerCase().includes('skin')) {
      serviceVariations.push('skin care', 'skin treatment', 'skin therapy', 'skin service', 'dermatology');
    }
    
    const qualityTerms = ['best', 'top rated', 'good', 'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'outstanding', 'superb', 'brilliant', 'perfect', 'ideal', 'awesome', 'incredible', 'marvelous', 'exceptional', 'remarkable'];
    const businessTypes = ['salon', 'parlor', 'center', 'studio', 'clinic', 'institute', 'academy', 'spa', 'beauty lounge', 'wellness center', 'boutique', 'shop', 'store', 'outlet', 'branch', 'franchise', 'place', 'location', 'venue'];
    const serviceTerms = ['services', 'treatment', 'therapy', 'consultation', 'booking', 'appointment', 'session', 'package', 'course', 'training', 'home service', 'at home', 'doorstep', 'pickup service', 'mobile service', 'work', 'job', 'task'];
    const locationTerms = ['near me', 'in', 'based in', 'located in', 'serving', 'available in', 'area', 'locality', 'district', 'zone', 'sector', 'block', 'colony', 'market', 'road', 'street', 'place', 'location'];
    const pricingTerms = ['affordable', 'budget friendly', 'cheap', 'low cost', 'pocket friendly', 'inexpensive', 'economical', 'reasonable', 'fair price', 'good value', 'best price', 'competitive rates', 'value for money', 'under 1000', 'under 5000', 'starting from', 'from 500', 'cost effective'];
    const timeTerms = ['same day', 'instant', 'quick', 'emergency', '24/7', 'immediate', 'urgent', 'round the clock', 'anytime', 'flexible timing', 'weekend service', 'fast', 'rapid', 'speedy', 'swift', 'prompt', 'early', 'late'];
    const expertiseTerms = ['specialist', 'master', 'qualified', 'trained', 'accredited', 'recognized', 'reputed', 'trusted', 'reliable', '10 years experience', '15+ years', 'decade of experience', 'skilled', 'talented', 'gifted', 'proficient', 'competent'];
    const reviewTerms = ['customer reviews', 'client feedback', 'testimonials', 'recommended', 'popular', 'famous', 'well known', 'established', 'rated', 'reviewed', 'praised', 'appreciated', 'loved', 'admired', 'respected'];
    const comparisonTerms = ['vs', 'compared to', 'better than', 'superior to', 'alternative to', 'instead of', 'replacement for', 'cheaper than', 'more affordable than', 'outperforms', 'beats', 'surpasses', 'exceeds', 'dominates'];
    const seasonalTerms = ['2024', 'latest', 'new', 'modern', 'contemporary', 'trending', 'festival', 'wedding season', 'party', 'special occasion', 'summer', 'winter', 'monsoon', 'seasonal', 'holiday special', 'current', 'recent', 'updated'];
    const problemTerms = ['solution for', 'fix for', 'treatment for', 'cure for', 'remedy for', 'hair loss', 'skin problems', 'beauty issues', 'makeup problems', 'emergency', 'urgent', 'quick fix', 'instant solution', 'immediate relief', 'help with', 'deal with', 'handle'];
    const demographicTerms = ['for men', 'for women', 'for kids', 'for seniors', 'for teens', 'unisex', 'family friendly', 'couple service', 'group booking', 'for adults', 'for children', 'for everyone', 'for all ages'];
    const techTerms = ['digital', 'online', 'app based', 'tech enabled', 'modern techniques', 'advanced', 'innovative', 'cutting edge', 'smart', 'automated', 'electronic', 'virtual', 'remote'];
    
    const fallbackSuggestions = [];
    
    // Generate comprehensive fast-ranking suggestions using multiple strategies
    // Always generate suggestions regardless of vendorCity
    // Strategy A: Service Variations + Quality
    serviceVariations.forEach(service => {
      qualityTerms.slice(0, 8).forEach(quality => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${quality} ${service} near me`);
          fallbackSuggestions.push(`${quality} ${service} expert`);
          fallbackSuggestions.push(`${quality} ${service} specialist`);
          fallbackSuggestions.push(`${service} ${quality} service`);
        }
      });
    });

    // Strategy B: Service Variations + Price
    serviceVariations.slice(0, 5).forEach(service => {
      pricingTerms.slice(0, 6).forEach(price => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${price} ${service} booking`);
          fallbackSuggestions.push(`${service} ${price} service`);
          fallbackSuggestions.push(`${price} ${service} area`);
          fallbackSuggestions.push(`${service} ${price} booking`);
        }
      });
    });

    // Strategy C: Service Variations + Expertise
    serviceVariations.slice(0, 4).forEach(service => {
      expertiseTerms.slice(0, 6).forEach(expertise => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${expertise} ${service} specialist`);
          fallbackSuggestions.push(`${service} ${expertise} service`);
          fallbackSuggestions.push(`${expertise} ${service} area`);
          fallbackSuggestions.push(`${service} ${expertise} booking`);
        }
      });
    });

    // Strategy D: Service Variations + Time
    serviceVariations.slice(0, 4).forEach(service => {
      timeTerms.slice(0, 5).forEach(time => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${time} ${service} service`);
          fallbackSuggestions.push(`${service} ${time} booking`);
          fallbackSuggestions.push(`${time} ${service} area`);
          fallbackSuggestions.push(`${service} ${time} service`);
        }
      });
    });

    // Strategy E: Service Variations + Reviews
    serviceVariations.slice(0, 3).forEach(service => {
      reviewTerms.slice(0, 4).forEach(review => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${service} ${review}`);
          fallbackSuggestions.push(`${review} ${service} service`);
          fallbackSuggestions.push(`${service} with ${review}`);
          fallbackSuggestions.push(`${review} ${service} booking`);
        }
      });
    });

    // Strategy F: Service Variations + Comparison
    serviceVariations.slice(0, 3).forEach(service => {
      comparisonTerms.slice(0, 4).forEach(comparison => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`best ${service} ${comparison} others`);
          fallbackSuggestions.push(`${service} ${comparison} competitors`);
          fallbackSuggestions.push(`${service} ${comparison} alternatives`);
          fallbackSuggestions.push(`${comparison} others ${service}`);
        }
      });
    });

    // Strategy G: Service Variations + Seasonal
    serviceVariations.slice(0, 3).forEach(service => {
      seasonalTerms.slice(0, 4).forEach(seasonal => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${seasonal} ${service} service`);
          fallbackSuggestions.push(`${service} ${seasonal} booking`);
          fallbackSuggestions.push(`${seasonal} ${service} area`);
          fallbackSuggestions.push(`${service} ${seasonal} service`);
        }
      });
    });

    // Strategy H: Service Variations + Problem Solving
    serviceVariations.slice(0, 3).forEach(service => {
      problemTerms.slice(0, 4).forEach(problem => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${service} ${problem}`);
          fallbackSuggestions.push(`${problem} ${service} solution`);
          fallbackSuggestions.push(`${service} ${problem} service`);
          fallbackSuggestions.push(`${problem} ${service} treatment`);
        }
      });
    });

    // Strategy I: Service Variations + Mixed combinations for maximum variety
    serviceVariations.slice(0, 2).forEach(service => {
      qualityTerms.slice(0, 3).forEach(quality => {
        pricingTerms.slice(0, 3).forEach(pricing => {
          timeTerms.slice(0, 3).forEach(time => {
            if (fallbackSuggestions.length < 200) {
              fallbackSuggestions.push(`${quality} ${service} ${pricing} ${time}`);
              fallbackSuggestions.push(`${pricing} ${service} ${quality} ${time}`);
              fallbackSuggestions.push(`${time} ${service} ${quality} ${pricing}`);
              fallbackSuggestions.push(`${service} ${quality} ${pricing} ${time}`);
            }
          });
        });
      });
    });

    // Strategy J: Service Variations + Demographics
    serviceVariations.slice(0, 2).forEach(service => {
      demographicTerms.slice(0, 4).forEach(demo => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${service} ${demo} service`);
          fallbackSuggestions.push(`best ${service} ${demo}`);
          fallbackSuggestions.push(`${service} ${demo} booking`);
          fallbackSuggestions.push(`${demo} ${service} specialist`);
        }
      });
    });

    // Strategy K: Service Variations + Technology
    serviceVariations.slice(0, 2).forEach(service => {
      techTerms.slice(0, 4).forEach(tech => {
        if (fallbackSuggestions.length < 200) {
          fallbackSuggestions.push(`${tech} ${service} service`);
          fallbackSuggestions.push(`${service} ${tech} booking`);
          fallbackSuggestions.push(`modern ${service} ${tech}`);
          fallbackSuggestions.push(`${service} ${tech} service`);
        }
      });
    });

    // Remove duplicates and limit
    const uniqueSuggestions = [...new Set(fallbackSuggestions)].slice(0, 200);

    res.status(200).json({
      success: true,
      message: `Keyword suggestions generated (fallback mode) for ${vendorLocation}`,
      suggestions: uniqueSuggestions,
      count: uniqueSuggestions.length,
      location: vendorLocation,
      city: vendorCity
    });
  }
};


// Add new service
const addService = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can add services",
      });
    }

    const {
      service_name,
      price,
      description,
      keywords,
      duration,
      availability,
    } = req.body;

    // Validate required fields
    if (!service_name || !price || !keywords) {
      return res.status(400).json({
        success: false,
        message: "Service name, price, and keywords are required",
      });
    }

    // Convert price to number and validate
    const numericPrice = parseFloat(price);
    if (!isValidPrice(numericPrice)) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid number greater than or equal to 0",
      });
    }

    // Parse keywords if it's a JSON string
    let parsedKeywords = keywords;
    if (typeof keywords === "string") {
      try {
        parsedKeywords = JSON.parse(keywords);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Keywords must be a valid JSON array",
        });
      }
    }

    // Validate keywords (minimum 10 required for SEO optimization)
    if (!validateKeywords(parsedKeywords)) {
      return res.status(400).json({
        success: false,
        message: "Minimum 10 keywords are required for better SEO optimization",
        data: {
          provided: Array.isArray(parsedKeywords) ? parsedKeywords.length : 0,
          required: 10,
          maximum: "unlimited",
          suggestion:
            "Use our keyword suggestion API to get SEO-friendly keywords",
          api_endpoint: "/gnet/services/suggest-keywords",
        },
      });
    }

    // Check if images are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least 1 service image is required",
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maximum 10 images allowed",
      });
    }

    // Get vendor's business category from KYC
    const vendorKyc = await VendorKyc.findOne({ vendor_id: vendorId });
    if (
      !vendorKyc ||
      !vendorKyc.business_details ||
      !vendorKyc.business_details.category
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor must have completed KYC with business category",
      });
    }

    // Prepare image paths
    const imagePaths = req.files.map(
      (file) => `/uploads/services/${file.filename}`
    );

    // Create service
    const serviceData = {
      vendor_id: vendorId,
      service_name: service_name.trim(),
      price: numericPrice,
      description: description ? description.trim() : "",
      images: imagePaths,
      keywords: parsedKeywords.map((keyword) => keyword.trim()),
      category: vendorKyc.business_details.category,
      duration: duration ? duration.trim() : "",
      availability: availability || "available",
    };

    const service = new Service(serviceData);
    await service.save();

    // Populate category details
    await service.populate("category", "category_name");

    res.status(201).json({
      success: true,
      message: "Service added successfully",
      data: {
        service_id: service._id,
        service_name: service.service_name,
        price: service.price,
        images: service.images,
        keywords: service.keywords,
        category: service.category,
        status: service.status,
        created_at: service.createdAt,
      },
    });
  } catch (error) {
    console.error("Add service error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get SEO-friendly keyword suggestions - REMOVED
const getKeywordSuggestions_REMOVED = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { keyword, location } = req.query;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can get keyword suggestions",
      });
    }

    if (!keyword || keyword.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Keyword must be at least 2 characters long",
      });
    }

    // Get vendor's business category and location
    const vendorKyc = await VendorKyc.findOne({ vendor_id: vendorId });
    if (
      !vendorKyc ||
      !vendorKyc.business_details ||
      !vendorKyc.business_details.category
    ) {
      return res.status(400).json({
        success: false,
        message: "Vendor must have completed KYC with business category",
      });
    }

    const categoryId = vendorKyc.business_details.category;
    const searchKeyword = keyword.trim().toLowerCase();
    const vendorLocation =
      location || vendorKyc.business_details.city || "Mumbai";

    // Get suggestions from database cache first
    let suggestions = await KeywordSuggestion.getSuggestions(
      categoryId,
      searchKeyword,
      20
    );

    // If no suggestions found, generate SEO-friendly suggestions
    if (suggestions.length === 0) {
      suggestions = await generateSEOFriendlySuggestions(
        categoryId,
        searchKeyword,
        vendorLocation,
        vendorKyc
      );

      // Save these suggestions for future use (learn from user behavior)
      await saveKeywordSuggestions(categoryId, searchKeyword, suggestions);
    }

    // Calculate SEO summary
    const seoSummary = {
      total_suggestions: suggestions.length,
      local_seo_count: suggestions.filter((s) => s.local_seo).length,
      long_tail_count: suggestions.filter((s) => s.long_tail).length,
      avg_seo_score:
        suggestions.length > 0
          ? (
              suggestions.reduce((sum, s) => sum + (s.seo_score || 0), 0) /
              suggestions.length
            ).toFixed(1)
          : 0,
      high_competition: suggestions.filter((s) => s.competition === "high")
        .length,
      medium_competition: suggestions.filter((s) => s.competition === "medium")
        .length,
      low_competition: suggestions.filter((s) => s.competition === "low")
        .length,
    };

    res.status(200).json({
      success: true,
      message: "SEO-friendly keyword suggestions retrieved successfully",
      data: {
        keyword: searchKeyword,
        category: vendorKyc.business_details.category,
        location: vendorLocation,
        suggestions: suggestions,
        count: suggestions.length,
        seo_summary: seoSummary,
        requirements: {
          minimum_keywords: 5,
          maximum_keywords: "unlimited",
          seo_optimized: true,
        },
      },
    });
  } catch (error) {
    console.error("Get keyword suggestions error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Generate default suggestions based on category
const generateDefaultSuggestions = async (categoryId, keyword) => {
  try {
    const category = await VendorCategory.findById(categoryId);
    if (!category) return [];

    const categoryName = category.category_name.toLowerCase();
    const suggestions = [];

    // Category-specific suggestions
    const categorySuggestions = {
      beauty: [
        `best ${keyword} salon`,
        `${keyword} parlor`,
        `${keyword} services`,
        `professional ${keyword}`,
        `${keyword} treatment`,
        `affordable ${keyword}`,
        `${keyword} specialist`,
        `expert ${keyword}`,
        `${keyword} center`,
        `quality ${keyword}`,
      ],
      education: [
        `best ${keyword} training`,
        `${keyword} course`,
        `${keyword} classes`,
        `professional ${keyword}`,
        `${keyword} institute`,
        `expert ${keyword}`,
        `${keyword} coaching`,
        `certified ${keyword}`,
        `${keyword} academy`,
        `quality ${keyword}`,
      ],
      technology: [
        `best ${keyword} development`,
        `${keyword} services`,
        `professional ${keyword}`,
        `${keyword} solutions`,
        `expert ${keyword}`,
        `${keyword} company`,
        `quality ${keyword}`,
        `${keyword} experts`,
        `reliable ${keyword}`,
        `${keyword} specialists`,
      ],
      healthcare: [
        `best ${keyword} clinic`,
        `${keyword} doctor`,
        `${keyword} treatment`,
        `professional ${keyword}`,
        `${keyword} specialist`,
        `expert ${keyword}`,
        `${keyword} care`,
        `quality ${keyword}`,
        `${keyword} services`,
        `reliable ${keyword}`,
      ],
      food: [
        `best ${keyword} restaurant`,
        `${keyword} food`,
        `${keyword} delivery`,
        `delicious ${keyword}`,
        `${keyword} cuisine`,
        `fresh ${keyword}`,
        `${keyword} catering`,
        `quality ${keyword}`,
        `${keyword} menu`,
        `authentic ${keyword}`,
      ],
    };

    // Get suggestions based on category
    let baseSuggestions = categorySuggestions[categoryName];

    // If category not found, generate dynamic suggestions
    if (!baseSuggestions) {
      baseSuggestions = generateDynamicSuggestions(categoryName, keyword);
    }

    // Filter and format suggestions
    baseSuggestions.forEach((suggestion) => {
      if (suggestion.toLowerCase().includes(keyword.toLowerCase())) {
        suggestions.push(suggestion);
      }
    });

    // Add some generic suggestions
    const genericSuggestions = [
      `best ${keyword}`,
      `${keyword} near me`,
      `top ${keyword}`,
      `quality ${keyword}`,
      `professional ${keyword}`,
      `expert ${keyword}`,
      `reliable ${keyword}`,
      `affordable ${keyword}`,
      `${keyword} services`,
      `trusted ${keyword}`,
    ];

    suggestions.push(...genericSuggestions);

    // Remove duplicates and limit to 15
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 15);

    return uniqueSuggestions;
  } catch (error) {
    console.error("Error generating default suggestions:", error);
    return [];
  }
};

// Generate dynamic suggestions for any category
// Generate comprehensive SEO-friendly suggestions for any category
const generateSEOFriendlySuggestions = async (
  categoryId,
  keyword,
  location,
  vendorData
) => {
  try {
    const category = await VendorCategory.findById(categoryId);
    if (!category) return [];

    const categoryName = category.category_name.toLowerCase();
    const suggestions = [];

    console.log(
      `Debug: Original category name: "${category.category_name}", Lowercase: "${categoryName}"`
    );

    // 1. Local SEO Keywords (Highest Priority)
    suggestions.push(
      `${keyword} in ${location}`,
      `best ${keyword} ${location}`,
      `${keyword} near me`,
      `top ${keyword} ${location}`,
      `${keyword} ${location} services`,
      `${keyword} ${location} booking`,
      `${keyword} ${location} rates`,
      `${keyword} ${location} reviews`
    );

    // 2. Long-tail Keywords (Medium Competition)
    suggestions.push(
      `professional ${keyword} services`,
      `affordable ${keyword} near me`,
      `best ${keyword} for ${categoryName}`,
      `quality ${keyword} ${location}`,
      `${keyword} consultation ${location}`,
      `expert ${keyword} services`,
      `certified ${keyword} ${location}`,
      `licensed ${keyword} services`
    );

    // 3. Intent-based Keywords
    suggestions.push(
      `${keyword} booking online`,
      `${keyword} appointment booking`,
      `${keyword} packages ${location}`,
      `${keyword} rates ${location}`,
      `${keyword} reviews ${location}`,
      `${keyword} contact ${location}`,
      `${keyword} inquiry ${location}`,
      `${keyword} quote ${location}`
    );

    // 4. Category-specific SEO patterns with better keywords
    const categoryPatterns = {
      salon: {
        local: ["salon", "parlor", "center", "studio", "spa", "beauty lounge"],
        services: [
          "haircut",
          "styling",
          "coloring",
          "treatment",
          "therapy",
          "facial",
          "manicure",
          "pedicure",
          "massage",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "luxury",
          "premium",
          "expert",
          "certified",
          "licensed",
        ],
        specific: [
          "bridal makeup",
          "party makeup",
          "hair spa",
          "keratin treatment",
          "hair straightening",
          "hair coloring",
          "beard styling",
        ],
      },
      beauty: {
        local: ["salon", "parlor", "center", "studio", "spa", "beauty lounge"],
        services: [
          "haircut",
          "styling",
          "coloring",
          "treatment",
          "therapy",
          "facial",
          "manicure",
          "pedicure",
          "massage",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "luxury",
          "premium",
          "expert",
          "certified",
          "licensed",
        ],
        specific: [
          "bridal makeup",
          "party makeup",
          "hair spa",
          "keratin treatment",
          "hair straightening",
          "hair coloring",
          "beard styling",
        ],
      },
      education: {
        local: [
          "institute",
          "academy",
          "center",
          "school",
          "college",
          "training center",
        ],
        services: [
          "training",
          "course",
          "classes",
          "coaching",
          "tutoring",
          "certification",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "expert",
          "certified",
          "qualified",
          "experienced",
        ],
        specific: [
          "react training",
          "javascript course",
          "python classes",
          "web development",
          "mobile app development",
          "data science",
        ],
      },
      technology: {
        local: ["company", "agency", "studio", "lab", "firm", "tech hub"],
        services: [
          "development",
          "solutions",
          "services",
          "consulting",
          "support",
          "maintenance",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "expert",
          "certified",
          "experienced",
          "skilled",
        ],
        specific: [
          "web development",
          "app development",
          "software solutions",
          "digital marketing",
          "cloud services",
          "AI solutions",
        ],
      },
      healthcare: {
        local: [
          "clinic",
          "hospital",
          "center",
          "care",
          "medical",
          "health center",
        ],
        services: [
          "treatment",
          "consultation",
          "care",
          "therapy",
          "diagnosis",
          "checkup",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "expert",
          "certified",
          "licensed",
          "qualified",
        ],
        specific: [
          "general checkup",
          "dental care",
          "eye care",
          "skin treatment",
          "physiotherapy",
          "cardiology",
        ],
      },
      food: {
        local: [
          "restaurant",
          "cafe",
          "kitchen",
          "diner",
          "bistro",
          "food court",
        ],
        services: [
          "delivery",
          "catering",
          "cooking",
          "meal",
          "cuisine",
          "takeaway",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "delicious",
          "fresh",
          "authentic",
          "premium",
        ],
        specific: [
          "pizza delivery",
          "biriyani",
          "cake",
          "catering",
          "home delivery",
          "party food",
        ],
      },
      photography: {
        local: [
          "studio",
          "photographer",
          "gallery",
          "center",
          "agency",
          "photo studio",
        ],
        services: [
          "photography",
          "shooting",
          "session",
          "event",
          "wedding",
          "portrait",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "creative",
          "expert",
          "skilled",
          "artistic",
        ],
        specific: [
          "wedding photography",
          "portrait session",
          "event photography",
          "product photography",
          "fashion shoot",
          "family photos",
        ],
      },
      fitness: {
        local: ["gym", "fitness", "center", "studio", "club", "fitness hub"],
        services: [
          "training",
          "workout",
          "fitness",
          "exercise",
          "coaching",
          "personal training",
        ],
        quality: [
          "top-rated",
          "award-winning",
          "expert",
          "certified",
          "personal",
          "qualified",
        ],
        specific: [
          "personal training",
          "yoga classes",
          "weight loss",
          "muscle building",
          "cardio workout",
          "fitness coaching",
        ],
      },
    };

    console.log(
      `Debug: categoryName="${categoryName}", categoryPatterns keys:`,
      Object.keys(categoryPatterns)
    );

    const patterns =
      categoryPatterns[categoryName] || categoryPatterns["beauty"];

    // Check if keyword is relevant to category
    const isKeywordRelevant = checkKeywordRelevance(
      keyword,
      categoryName,
      patterns
    );

    console.log(
      `Debug: keyword="${keyword}", category="${categoryName}", isRelevant=${isKeywordRelevant}`
    );

    if (isKeywordRelevant) {
      // Generate category-specific suggestions with better keywords
      patterns.local.forEach((local) => {
        suggestions.push(
          `top 10 ${keyword} ${local} ${location}`,
          `best ${keyword} ${local} in ${location}`,
          `${keyword} ${local} near me`,
          `top-rated ${keyword} ${local}`,
          `award-winning ${keyword} ${local}`
        );
      });

      patterns.services.forEach((service) => {
        suggestions.push(
          `${keyword} ${service} ${location}`,
          `best ${keyword} ${service} near me`,
          `top-rated ${keyword} ${service}`,
          `${keyword} ${service} booking`,
          `luxury ${keyword} ${service}`
        );
      });

      patterns.quality.forEach((quality) => {
        suggestions.push(
          `${quality} ${keyword} services`,
          `${quality} ${keyword} ${location}`,
          `${quality} ${keyword} near me`,
          `${quality} ${keyword} booking`,
          `${quality} ${keyword} prices`
        );
      });

      // Add specific category keywords
      patterns.specific.forEach((specific) => {
        if (
          specific.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(specific.toLowerCase())
        ) {
          suggestions.push(
            `best ${specific} ${location}`,
            `${specific} near me`,
            `top-rated ${specific}`,
            `${specific} booking`,
            `luxury ${specific}`
          );
        }
      });
    } else {
      // If keyword is not relevant to category, suggest category-specific keywords instead
      suggestions.push(
        `best ${categoryName} services ${location}`,
        `top ${categoryName} near me`,
        `award-winning ${categoryName} ${location}`,
        `luxury ${categoryName} services`,
        `premium ${categoryName} ${location}`
      );

      // Add specific category keywords (only relevant ones)
      patterns.specific.forEach((specific) => {
        suggestions.push(
          `best ${specific} ${location}`,
          `${specific} near me`,
          `top-rated ${specific}`,
          `${specific} booking`,
          `luxury ${specific}`
        );
      });

      // Add service-specific keywords
      patterns.services.forEach((service) => {
        suggestions.push(
          `best ${service} ${location}`,
          `${service} near me`,
          `top-rated ${service}`,
          `${service} booking`,
          `luxury ${service}`
        );
      });
    }

    // 5. Modern/Trending Keywords
    suggestions.push(
      `${keyword} 2024`,
      `modern ${keyword}`,
      `digital ${keyword}`,
      `online ${keyword} booking`,
      `${keyword} app`,
      `mobile ${keyword}`,
      `instant ${keyword}`,
      `same day ${keyword}`
    );

    // 6. Business-specific suggestions based on vendor data
    if (vendorData && vendorData.business_details) {
      const businessName = vendorData.business_details.business_name;
      if (businessName) {
        suggestions.push(
          `${businessName} ${keyword}`,
          `${keyword} at ${businessName}`,
          `${businessName} ${keyword} services`
        );
      }
    }

    // 7. Calculate SEO scores and format
    const scoredSuggestions = suggestions.map((suggestion) => ({
      keyword: suggestion,
      seo_score: calculateSEOScore(suggestion),
      length: suggestion.length,
      local_seo:
        suggestion.includes("near me") ||
        suggestion.includes("in ") ||
        suggestion.includes(location),
      long_tail: suggestion.length > 15,
      competition: getCompetitionLevel(suggestion),
      search_volume: getSearchVolume(suggestion),
      category_relevance: getCategoryRelevance(suggestion, categoryName),
    }));

    // Remove duplicates and sort by SEO score
    const uniqueSuggestions = scoredSuggestions.filter(
      (suggestion, index, self) =>
        index === self.findIndex((s) => s.keyword === suggestion.keyword)
    );

    uniqueSuggestions.sort((a, b) => b.seo_score - a.seo_score);

    return uniqueSuggestions.slice(0, 25); // Return top 25 suggestions
  } catch (error) {
    console.error("Generate SEO suggestions error:", error);
    return [];
  }
};

// Calculate comprehensive SEO score
const calculateSEOScore = (keyword) => {
  let score = 0;

  // Length bonus (long-tail keywords are better)
  if (keyword.length > 25) score += 4;
  else if (keyword.length > 20) score += 3;
  else if (keyword.length > 15) score += 2;
  else if (keyword.length > 10) score += 1;

  // Local SEO bonus
  if (keyword.includes("near me")) score += 3;
  if (keyword.includes("in ")) score += 2;
  if (keyword.includes("location") || keyword.includes("city")) score += 2;

  // Quality words bonus
  const qualityWords = [
    "best",
    "professional",
    "expert",
    "certified",
    "quality",
    "top",
    "premium",
  ];
  qualityWords.forEach((word) => {
    if (keyword.includes(word)) score += 1;
  });

  // Service words bonus
  const serviceWords = [
    "services",
    "treatment",
    "consultation",
    "booking",
    "appointment",
  ];
  serviceWords.forEach((word) => {
    if (keyword.includes(word)) score += 1;
  });

  // Intent words bonus
  const intentWords = ["online", "instant", "same day", "24/7", "emergency"];
  intentWords.forEach((word) => {
    if (keyword.includes(word)) score += 1;
  });

  // Uniqueness bonus (avoid generic words)
  const genericWords = ["good", "nice", "ok", "fine"];
  genericWords.forEach((word) => {
    if (keyword.includes(word)) score -= 1;
  });

  return Math.max(0, score); // Ensure non-negative score
};

// Get competition level
const getCompetitionLevel = (keyword) => {
  if (keyword.includes("near me") || keyword.includes("in ")) return "medium";
  if (keyword.length > 25) return "low";
  if (
    keyword.includes("best") ||
    keyword.includes("top") ||
    keyword.includes("professional")
  )
    return "high";
  if (keyword.includes("affordable") || keyword.includes("cheap"))
    return "high";
  return "medium";
};

// Get search volume
const getSearchVolume = (keyword) => {
  if (keyword.includes("near me") || keyword.includes("in ")) return "high";
  if (keyword.length > 25) return "medium";
  if (keyword.includes("best") || keyword.includes("top")) return "high";
  return "medium";
};

// Get category relevance
const getCategoryRelevance = (keyword, categoryName) => {
  const categoryWords = categoryName.split(" ");
  let relevance = 0;

  categoryWords.forEach((word) => {
    if (keyword.toLowerCase().includes(word.toLowerCase())) {
      relevance += 1;
    }
  });

  return relevance;
};

// Check if keyword is relevant to the vendor's category
const checkKeywordRelevance = (keyword, categoryName, patterns) => {
  const keywordLower = keyword.toLowerCase();
  const categoryLower = categoryName.toLowerCase();

  // Special case: beauty keyword should be relevant to salon/beauty category
  if (
    keywordLower === "beauty" &&
    (categoryLower.includes("beauty") || categoryLower.includes("salon"))
  ) {
    return true;
  }

  // Check if keyword matches category name
  if (
    keywordLower.includes(categoryLower) ||
    categoryLower.includes(keywordLower)
  ) {
    return true;
  }

  // Check if keyword matches any service in the category
  const allServices = patterns.services || [];
  for (const service of allServices) {
    if (
      keywordLower.includes(service.toLowerCase()) ||
      service.toLowerCase().includes(keywordLower)
    ) {
      return true;
    }
  }

  // Check if keyword matches any specific category keywords
  const specificKeywords = patterns.specific || [];
  for (const specific of specificKeywords) {
    if (
      keywordLower.includes(specific.toLowerCase()) ||
      specific.toLowerCase().includes(keywordLower)
    ) {
      return true;
    }
  }

  // Check if keyword matches any local terms
  const localTerms = patterns.local || [];
  for (const local of localTerms) {
    if (
      keywordLower.includes(local.toLowerCase()) ||
      local.toLowerCase().includes(keywordLower)
    ) {
      return true;
    }
  }

  return false;
};

// Save keyword suggestions for future use (learning system)
const saveKeywordSuggestions = async (categoryId, baseKeyword, suggestions) => {
  try {
    // Check if suggestions already exist
    const existingSuggestion = await KeywordSuggestion.findOne({
      category_id: categoryId,
      base_keyword: baseKeyword,
    });

    if (!existingSuggestion) {
      // Create new suggestion entry with SEO data
      const suggestionData = {
        category_id: categoryId,
        base_keyword: baseKeyword,
        suggestions: suggestions.map((suggestion) => ({
          keyword: suggestion.keyword,
          seo_score: suggestion.seo_score || 0,
          length: suggestion.length || 0,
          local_seo: suggestion.local_seo || false,
          long_tail: suggestion.long_tail || false,
          competition: suggestion.competition || "medium",
          search_volume: suggestion.search_volume || "medium",
          category_relevance: suggestion.category_relevance || 0,
          popularity: Math.floor(Math.random() * 10) + 1,
          usage_count: 1, // Start with 1 usage
          click_through_rate: 0,
        })),
      };

      await KeywordSuggestion.create(suggestionData);
      console.log(
        `Saved new SEO-friendly keyword suggestions for ${baseKeyword} in category ${categoryId}`
      );
    }
  } catch (error) {
    console.error("Error saving keyword suggestions:", error);
    // Don't throw error, just log it
  }
};

// Get all services for a vendor
const getVendorServices = async (req, res) => {
  try {
    const vendorId = req.user._id;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can view their services",
      });
    }

    const { status = "active", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { vendor_id: vendorId };
    if (status !== "all") {
      query.status = status;
    }

    // Get services with pagination
    const services = await Service.find(query)
      .populate("category", "category_name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Service.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Services retrieved successfully",
      data: {
        services: services,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get vendor services error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get service details
const getServiceDetails = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { service_id } = req.params;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can view service details",
      });
    }

    // Validate service_id
    if (!isValidObjectId(service_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Find service
    const service = await Service.findOne({
      _id: service_id,
      vendor_id: vendorId,
    }).populate("category", "category_name");

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service details retrieved successfully",
      data: service,
    });
  } catch (error) {
    console.error("Get service details error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update service
const updateService = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { service_id } = req.params;
    const {
      service_name,
      price,
      description,
      keywords,
      duration,
      availability,
      status,
    } = req.body;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can update services",
      });
    }

    // Validate service_id
    if (!isValidObjectId(service_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Find service
    const service = await Service.findOne({
      _id: service_id,
      vendor_id: vendorId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Update fields
    if (service_name) service.service_name = service_name.trim();
    if (price !== undefined) {
      if (!isValidPrice(price)) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid number greater than or equal to 0",
        });
      }
      service.price = parseFloat(price);
    }
    if (description !== undefined) service.description = description.trim();
    if (keywords) {
      if (!validateKeywords(keywords)) {
        return res.status(400).json({
          success: false,
          message:
            "At least 5 keywords are required, each between 2-50 characters",
        });
      }
      service.keywords = keywords.map((keyword) => keyword.trim());
    }
    if (duration !== undefined) service.duration = duration.trim();
    if (availability) service.availability = availability;
    if (status) service.status = status;

    // Handle image updates if new images are uploaded
    if (req.files && req.files.length > 0) {
      if (req.files.length > 10) {
        return res.status(400).json({
          success: false,
          message: "Maximum 10 images allowed",
        });
      }

      const newImagePaths = req.files.map(
        (file) => `/uploads/services/${file.filename}`
      );
      service.images = newImagePaths;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: {
        service_id: service._id,
        service_name: service.service_name,
        price: service.price,
        status: service.status,
        updated_at: service.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update service error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete service
const deleteService = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { service_id } = req.params;

    // Validate vendor role
    if (req.user.role !== "vendor") {
      return res.status(403).json({
        success: false,
        message: "Only vendors can delete services",
      });
    }

    // Validate service_id
    if (!isValidObjectId(service_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Find and delete service
    const service = await Service.findOneAndDelete({
      _id: service_id,
      vendor_id: vendorId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
      data: {
        service_id: service._id,
        service_name: service.service_name,
      },
    });
  } catch (error) {
    console.error("Delete service error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Search services (public endpoint)
const searchServices = async (req, res) => {
  try {
    const {
      q,
      category,
      min_price,
      max_price,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (page - 1) * limit;

    // Build search query
    const query = { status: "active" };

    if (q) {
      query.$or = [
        { service_name: { $regex: q, $options: "i" } },
        { keywords: { $regex: q, $options: "i" } },
        { search_tags: { $regex: q, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (min_price || max_price) {
      query.price = {};
      if (min_price) query.price.$gte = parseFloat(min_price);
      if (max_price) query.price.$lte = parseFloat(max_price);
    }

    // Get services with pagination
    const services = await Service.find(query)
      .populate("vendor_id", "name")
      .populate("category", "category_name")
      .sort({ "rating.average": -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Service.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Services found",
      data: {
        services: services,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Search services error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  addService,
  getVendorServices,
  getServiceDetails,
  updateService,
  deleteService,
  searchServices,
  getKeywordSuggestions,
  testEndpoint
};
