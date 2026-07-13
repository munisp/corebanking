/// Country-State-City data for location picker
/// Comprehensive data for multiple countries
class CSCData {
  /// Map of countries with their states and cities
  static const Map<String, Map<String, List<String>>> countryData = {
    'Nigeria': {
      'Abia': ['Aba', 'Umuahia', 'Ohafia', 'Arochukwu', 'Bende'],
      'Adamawa': ['Yola', 'Mubi', 'Numan', 'Jimeta', 'Ganye'],
      'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak'],
      'Anambra': ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Ihiala'],
      'Bauchi': ['Bauchi', 'Azare', 'Misau', 'Jama\'are', 'Katagum'],
      'Bayelsa': ['Yenagoa', 'Brass', 'Sagbama', 'Ogbia', 'Nembe'],
      'Benue': ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya'],
      'Borno': ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Gubio'],
      'Cross River': ['Calabar', 'Ugep', 'Ogoja', 'Ikom', 'Obudu'],
      'Delta': ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'],
      'Ebonyi': ['Abakaliki', 'Afikpo', 'Onueke', 'Ezza', 'Ishielu'],
      'Edo': ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Ubiaja'],
      'Ekiti': ['Ado-Ekiti', 'Ikere', 'Oye', 'Efon-Alaaye', 'Ilawe-Ekiti'],
      'Enugu': ['Enugu', 'Nsukka', 'Agbani', 'Awgu', 'Oji River'],
      'FCT': ['Abuja', 'Gwagwalada', 'Kuje', 'Bwari', 'Kwali'],
      'Gombe': ['Gombe', 'Kumo', 'Bajoga', 'Deba', 'Kaltungo'],
      'Imo': ['Owerri', 'Orlu', 'Okigwe', 'Mbaise', 'Nkwerre'],
      'Jigawa': ['Dutse', 'Hadejia', 'Gumel', 'Kazaure', 'Ringim'],
      'Kaduna': ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Soba'],
      'Kano': ['Kano', 'Wudil', 'Bichi', 'Gwarzo', 'Rano'],
      'Katsina': ['Katsina', 'Daura', 'Funtua', 'Malumfashi', 'Dutsin-Ma'],
      'Kebbi': ['Birnin Kebbi', 'Argungu', 'Zuru', 'Yauri', 'Gwandu'],
      'Kogi': ['Lokoja', 'Okene', 'Kabba', 'Ankpa', 'Idah'],
      'Kwara': ['Ilorin', 'Offa', 'Omu-Aran', 'Jebba', 'Lafiagi'],
      'Lagos': ['Ikeja', 'Lagos Island', 'Surulere', 'Ikorodu', 'Epe', 'Badagry', 'Lekki', 'Victoria Island', 'Yaba', 'Apapa'],
      'Nasarawa': ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa', 'Doma'],
      'Niger': ['Minna', 'Bida', 'Kontagora', 'Suleja', 'Lapai'],
      'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ilaro', 'Ota'],
      'Ondo': ['Akure', 'Ondo', 'Owo', 'Ikare', 'Ore'],
      'Osun': ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo'],
      'Oyo': ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin', 'Saki'],
      'Plateau': ['Jos', 'Bukuru', 'Pankshin', 'Vom', 'Shendam'],
      'Rivers': ['Port Harcourt', 'Bonny', 'Degema', 'Eleme', 'Okrika'],
      'Sokoto': ['Sokoto', 'Tambuwal', 'Gwadabawa', 'Bodinga', 'Wurno'],
      'Taraba': ['Jalingo', 'Wukari', 'Bali', 'Ibi', 'Gembu'],
      'Yobe': ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam'],
      'Zamfara': ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Tsafe', 'Bungudu'],
    },
    'United States': {
      'Alabama': ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'],
      'Alaska': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
      'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'],
      'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Bakersfield'],
      'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'],
      'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Tallahassee', 'Fort Lauderdale', 'St. Petersburg'],
      'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens'],
      'Illinois': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville'],
      'Massachusetts': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
      'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'],
      'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
      'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
      'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
    },
    'United Kingdom': {
      'England': ['London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Newcastle', 'Nottingham', 'Southampton'],
      'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling'],
      'Wales': ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry'],
      'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh'],
    },
    'Canada': {
      'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert'],
      'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna'],
      'Manitoba': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie'],
      'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan'],
      'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke'],
    },
    'Ghana': {
      'Greater Accra': ['Accra', 'Tema', 'Madina', 'Adenta', 'Teshie'],
      'Ashanti': ['Kumasi', 'Obuasi', 'Mampong', 'Ejisu', 'Bekwai'],
      'Western': ['Sekondi-Takoradi', 'Tarkwa', 'Prestea', 'Axim', 'Elubo'],
      'Eastern': ['Koforidua', 'Nkawkaw', 'Mpraeso', 'Akim Oda', 'Akropong'],
      'Central': ['Cape Coast', 'Winneba', 'Kasoa', 'Swedru', 'Saltpond'],
      'Northern': ['Tamale', 'Yendi', 'Savelugu', 'Gushegu', 'Tolon'],
    },
    'South Africa': {
      'Gauteng': ['Johannesburg', 'Pretoria', 'Soweto', 'Benoni', 'Boksburg', 'Randburg'],
      'Western Cape': ['Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Hermanus'],
      'KwaZulu-Natal': ['Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Ladysmith'],
      'Eastern Cape': ['Port Elizabeth', 'East London', 'Mthatha', 'Graaff-Reinet', 'Grahamstown'],
    },
    'Kenya': {
      'Nairobi': ['Nairobi', 'Kibera', 'Westlands', 'Karen', 'Langata'],
      'Mombasa': ['Mombasa', 'Nyali', 'Bamburi', 'Likoni', 'Changamwe'],
      'Kisumu': ['Kisumu', 'Ahero', 'Maseno', 'Muhoroni', 'Kombewa'],
      'Nakuru': ['Nakuru', 'Naivasha', 'Gilgil', 'Njoro', 'Molo'],
    },
    'India': {
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad'],
      'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
      'Delhi': ['New Delhi', 'Central Delhi', 'South Delhi', 'North Delhi', 'East Delhi'],
      'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
    },
  };

  /// Get all available countries
  static List<String> getCountries() {
    return countryData.keys.toList()..sort();
  }

  /// Get states for a specific country
  static List<String> getStates(String country) {
    final states = countryData[country]?.keys.toList() ?? [];
    return states..sort();
  }

  /// Get cities for a specific country and state
  static List<String> getCities(String country, String state) {
    return countryData[country]?[state] ?? [];
  }

  /// Check if a country exists
  static bool hasCountry(String country) {
    return countryData.containsKey(country);
  }

  /// Check if a state exists in a country
  static bool hasState(String country, String state) {
    return countryData[country]?.containsKey(state) ?? false;
  }

  /// Check if a city exists in a country and state
  static bool hasCity(String country, String state, String city) {
    return countryData[country]?[state]?.contains(city) ?? false;
  }
}
