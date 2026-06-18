/// VoiceProfile model for Nigerian accents
/// Supports YarnGPT TTS voices with Nigerian accents
library;

class VoiceProfile {
  final String id;
  final String name;
  final String gender; // 'male' or 'female'
  final String accent; // 'igbo', 'yoruba', 'hausa', 'lagos', 'general'
  final String? yarnGptVoice; // YarnGPT API voice name

  VoiceProfile({
    required this.id,
    required this.name,
    required this.gender,
    required this.accent,
    this.yarnGptVoice,
  });
}

// List of Nigerian voice profiles mapped to YarnGPT TTS voices
List<VoiceProfile> nigerianVoiceProfiles = [
  // Female voices
  VoiceProfile(
    id: '1',
    name: 'Idera (Melodic & Gentle)',
    gender: 'female',
    accent: 'general',
    yarnGptVoice: 'Idera',
  ),
  VoiceProfile(
    id: '2',
    name: 'Zainab (Soothing)',
    gender: 'female',
    accent: 'hausa',
    yarnGptVoice: 'Zainab',
  ),
  VoiceProfile(
    id: '3',
    name: 'Wura (Young & Sweet)',
    gender: 'female',
    accent: 'yoruba',
    yarnGptVoice: 'Wura',
  ),
  VoiceProfile(
    id: '4',
    name: 'Chinenye (Engaging)',
    gender: 'female',
    accent: 'igbo',
    yarnGptVoice: 'Chinenye',
  ),
  VoiceProfile(
    id: '5',
    name: 'Regina (Mature & Warm)',
    gender: 'female',
    accent: 'general',
    yarnGptVoice: 'Regina',
  ),
  VoiceProfile(
    id: '6',
    name: 'Adaora (Warm)',
    gender: 'female',
    accent: 'igbo',
    yarnGptVoice: 'Adaora',
  ),
  VoiceProfile(
    id: '7',
    name: 'Mary (Energetic)',
    gender: 'female',
    accent: 'general',
    yarnGptVoice: 'Mary',
  ),
  VoiceProfile(
    id: '8',
    name: 'Remi (Melodious)',
    gender: 'female',
    accent: 'yoruba',
    yarnGptVoice: 'Remi',
  ),
  
  // Male voices
  VoiceProfile(
    id: '9',
    name: 'Emma (Authoritative)',
    gender: 'male',
    accent: 'general',
    yarnGptVoice: 'Emma',
  ),
  VoiceProfile(
    id: '10',
    name: 'Osagie (Smooth & Calm)',
    gender: 'male',
    accent: 'general',
    yarnGptVoice: 'Osagie',
  ),
  VoiceProfile(
    id: '11',
    name: 'Jude (Confident)',
    gender: 'male',
    accent: 'general',
    yarnGptVoice: 'Jude',
  ),
  VoiceProfile(
    id: '12',
    name: 'Tayo (Energetic)',
    gender: 'male',
    accent: 'yoruba',
    yarnGptVoice: 'Tayo',
  ),
  VoiceProfile(
    id: '13',
    name: 'Femi (Reassuring)',
    gender: 'male',
    accent: 'yoruba',
    yarnGptVoice: 'Femi',
  ),
  VoiceProfile(
    id: '14',
    name: 'Umar (Calm)',
    gender: 'male',
    accent: 'hausa',
    yarnGptVoice: 'Umar',
  ),
  VoiceProfile(
    id: '15',
    name: 'Nonso (Bold)',
    gender: 'male',
    accent: 'igbo',
    yarnGptVoice: 'Nonso',
  ),
  VoiceProfile(
    id: '16',
    name: 'Adam (Deep & Clear)',
    gender: 'male',
    accent: 'general',
    yarnGptVoice: 'Adam',
  ),
];
