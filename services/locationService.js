const axios = require('axios');

// Location service for getting user's current location
class LocationService {
    
    // Get user's location from IP address (fallback method)
    async getLocationFromIP(ipAddress) {
        try {
            // Using ipapi.co for IP-based location
            const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`);
            
            if (response.data && response.data.city) {
                return {
                    latitude: response.data.latitude,
                    longitude: response.data.longitude,
                    address: `${response.data.city}, ${response.data.region}, ${response.data.country}`,
                    city: response.data.city,
                    state: response.data.region,
                    country: response.data.country,
                    source: 'ip'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting location from IP:', error);
            return null;
        }
    }

    // Get location from coordinates (reverse geocoding)
    async getLocationFromCoordinates(latitude, longitude) {
        try {
            // Using OpenStreetMap Nominatim API (free)
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
            );
            
            if (response.data && response.data.address) {
                const address = response.data.address;
                
                // Extract pincode from address
                let pincode = null;
                if (address.postcode) {
                    pincode = address.postcode;
                    console.log('Pincode from postcode:', pincode);
                } else if (address.postal_code) {
                    pincode = address.postal_code;
                    console.log('Pincode from postal_code:', pincode);
                } else {
                    console.log('No pincode found in address:', address);
                }
                
                return {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    address: response.data.display_name,
                    city: address.city || address.town || address.village || address.county,
                    state: address.state,
                    country: address.country,
                    pincode: pincode,
                    source: 'coordinates'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting location from coordinates:', error);
            return null;
        }
    }

    // Validate coordinates
    validateCoordinates(latitude, longitude) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        
        if (isNaN(lat) || isNaN(lon)) {
            return false;
        }
        
        if (lat < -90 || lat > 90) {
            return false;
        }
        
        if (lon < -180 || lon > 180) {
            return false;
        }
        
        return true;
    }

    // Calculate distance between two coordinates (in kilometers)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance;
    }

    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // Get nearby vendors/individuals based on location
    async getNearbyRecipients(recipients, userLat, userLon, radiusKm = 50) {
        try {
            const nearbyRecipients = [];
            
            for (const recipient of recipients) {
                // You might want to store vendor/individual locations in their profiles
                // For now, we'll return all recipients
                // In future, you can add location filtering here
                nearbyRecipients.push(recipient);
            }
            
            return nearbyRecipients;
        } catch (error) {
            console.error('Error filtering nearby recipients:', error);
            return recipients; // Return all if error
        }
    }
}

// Create singleton instance
const locationService = new LocationService();

module.exports = locationService;
