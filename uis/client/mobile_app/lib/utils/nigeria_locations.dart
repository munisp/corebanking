/// Nigeria states and cities data for location picker
class NigeriaLocations {
  static const Map<String, List<String>> statesAndCities = {
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
  };

  static List<String> getStates() {
    return statesAndCities.keys.toList()..sort();
  }

  static List<String> getCities(String state) {
    return statesAndCities[state] ?? [];
  }
}
