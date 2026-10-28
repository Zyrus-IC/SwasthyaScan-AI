import React, { createContext, useContext, useState } from 'react'

export type Language = 'en' | 'ta' | 'hi'

interface Translations {
  nav: {
    home: string
    howItWorks: string
    about: string
    forDoctors: string
    joinCode: string
    startScreening: string
  }
  hero: {
    badge: string
    headline1: string
    headline2: string
    subheading: string
    ctaScreening: string
    ctaHowItWorks: string
    statTBAffected: string
    statTBAffectedLabel: string
    statSpeed: string
    statSpeedLabel: string
  }
  problem: {
    tag: string
    title: string
    desc: string
    card1Val: string
    card1Label: string
    card1Desc: string
    card2Val: string
    card2Label: string
    card2Desc: string
    card3Val: string
    card3Label: string
    card3Desc: string
  }
  workflow: {
    tag: string
    title: string
    desc: string
  }
  chatbot: {
    tooltip: string
    assistantBadge: string
    liveStatus: string
    offlineStatus: string
    suggestedTitle: string
    welcome: string
    chips: { icon: string; text: string }[]
    inputPlaceholder: string
    hint: string
    disclaimer: string
    retry: string
  }
  auth: {
    badge: string
    title: string
    subtitle: string
    tabPhone: string
    tabEmail: string
    phoneLabel: string
    phonePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    sendCode: string
    verifyCode: string
    enterCode: string
    codeSentTo: string
    resend: string
    resendIn: string
    changeNumber: string
    securityNote: string
    signOut: string
    welcomeBack: string
  }
}

const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    nav: {
      home: 'Home',
      howItWorks: 'How It Works',
      about: 'About',
      forDoctors: 'For Doctors',
      joinCode: 'Join with Code',
      startScreening: 'Start Screening',
    },
    hero: {
      badge: 'AI-Assisted TB Screening Platform',
      headline1: 'Can AI help detect Tuberculosis',
      headline2: 'before it spreads?',
      subheading:
        'A clinically-informed medical platform combining deep learning chest X-ray screening with a multi-layered reliability engine and doctor verification.',
      ctaScreening: 'Start Screening',
      ctaHowItWorks: 'How It Works',
      statTBAffected: '10.6M+',
      statTBAffectedLabel: 'Global active cases annually (WHO)',
      statSpeed: '< 2.5s',
      statSpeedLabel: 'Fast inference & reliability check',
    },
    problem: {
      tag: 'THE CLINICAL CHALLENGE',
      title: 'Tuberculosis remains the deadliest bacterial disease',
      desc: 'Early detection saves lives, but standard diagnostic pathways face severe barriers in underserved and rural communities.',
      card1Val: '1.3 Million',
      card1Label: 'Lives lost every single year',
      card1Desc: 'TB continues to claim over 3,500 lives daily despite being largely curable with timely intervention.',
      card2Val: '40% Missed',
      card2Label: 'Initial diagnosis gap',
      card2Desc: 'Nearly 4 million infected individuals go undiagnosed or unreported annually worldwide.',
      card3Val: '10-14 Days',
      card3Label: 'Standard culture test delay',
      card3Desc: 'Laboratory sputum culture turnaround times can delay vital treatment initiation for weeks.',
    },
    workflow: {
      tag: 'SCREENING PIPELINE',
      title: 'Reliability-First 6-Step Verification',
      desc: 'How SwasthyaScan AI screens chest radiographs with rigorous quality and reliability checks.',
    },
    chatbot: {
      tooltip: 'Ask SwasthyaScan AI',
      assistantBadge: 'ASSISTANT',
      liveStatus: 'Live & Ready',
      offlineStatus: 'Service Offline',
      suggestedTitle: 'Suggested Questions',
      welcome:
        "Namaste! 👋 I'm **SwasthyaScan AI Assistant**.\n\n" +
        "I'm here to help explain **Tuberculosis (TB)** symptoms, prevention, chest health concepts, and how the screening prototype works.\n\n" +
        "How can I assist you today?",
      chips: [
        { icon: '🫁', text: 'What is tuberculosis?' },
        { icon: '⚡', text: 'How does SwasthyaScan work?' },
        { icon: '📋', text: 'What do the result flags mean?' },
        { icon: '🩺', text: 'What are TB symptoms?' },
      ],
      inputPlaceholder: 'Ask anything about TB or chest health… (Enter to send)',
      hint: 'Enter to send · Shift+Enter for new line',
      disclaimer: 'Educational info only · Not a diagnosis · Private & no data saved',
      retry: 'Retry question',
    },
    auth: {
      badge: 'Secure Patient & Clinician Portal',
      title: 'Sign In to SwasthyaScan AI',
      subtitle: 'Access preliminary TB screening, detailed clinical metrics, and your AI assistant.',
      tabPhone: 'Mobile (10 Digits)',
      tabEmail: 'Gmail / Email',
      phoneLabel: '10-Digit Mobile Number',
      phonePlaceholder: 'Enter 10-digit mobile number',
      emailLabel: 'Email Address',
      emailPlaceholder: 'e.g. yourname@gmail.com',
      sendCode: 'Send Verification Code',
      verifyCode: 'Verify & Enter Website',
      enterCode: 'Enter 6-Digit Code',
      codeSentTo: 'Verification code sent to',
      resend: 'Resend Code',
      resendIn: 'Resend in',
      changeNumber: 'Change',
      securityNote: 'Encrypted & HIPAA/NDHM privacy aligned. Zero tracking.',
      signOut: 'Sign Out',
      welcomeBack: 'Welcome',
    },
  },
  ta: {
    nav: {
      home: 'முகப்பு',
      howItWorks: 'செயல்முறை',
      about: 'பற்றி',
      forDoctors: 'மருத்துவர்களுக்கு',
      joinCode: 'குறியீட்டுடன் இணையுங்கள்',
      startScreening: 'பரிசோதனையைத் தொடங்கு',
    },
    hero: {
      badge: 'AI காசநோய் பரிசோதனை தளம்',
      headline1: 'காசநோய் பரவுவதற்கு முன்',
      headline2: 'AI-ஆல் கண்டறிய முடியுமா?',
      subheading:
        'மார்பக எக்ஸ்-ரே படங்களை ஆராய்ந்து, பல அடுக்கு நம்பகத்தன்மை சோதனைகளுடன் மருத்துவர் மேற்பார்வையில் இயங்கும் நவீன AI பரிசோதனை தளம்.',
      ctaScreening: 'பரிசோதனையைத் தொடங்கு',
      ctaHowItWorks: 'செயல்முறை எப்படி?',
      statTBAffected: '10.6 மில்லியன்+',
      statTBAffectedLabel: 'உலகளவில் ஆண்டுதோறும் பாதிப்பு (WHO)',
      statSpeed: '< 2.5 நொடி',
      statSpeedLabel: 'விரைவான AI முடிவு மற்றும் நம்பகத்தன்மை சோதனை',
    },
    problem: {
      tag: 'மருத்துவ சவால்',
      title: 'காசநோய் இன்னும் தீவிர அச்சுறுத்தலாக உள்ளது',
      desc: 'ஆரம்ப நிலையிலேயே கண்டறிவது உயிர்களைக் காக்கும், ஆனால் கிராமப்புறங்களில் பரிசோதனை வசதிகள் கிடைப்பது கடினமாக உள்ளது.',
      card1Val: '1.3 மில்லியன்',
      card1Label: 'ஆண்டுதோறும் உயிரிழப்புகள்',
      card1Desc: 'சரியான நேரத்தில் சிகிச்சை கிடைத்தால் குணப்படுத்தக்கூடிய இந்நோயால் தினமும் 3,500-க்கும் மேற்பட்டோர் உயிரிழக்கின்றனர்.',
      card2Val: '40% தவறவிடப்படும்',
      card2Label: 'ஆரம்பக் கட்ட நோயறிதல் இடைவெளி',
      card2Desc: 'உலகளவில் சுமார் 40 லட்சம் பேர் ஆரம்பத்தில் கண்டறியப்படாமல் விடுபடுகின்றனர்.',
      card3Val: '10-14 நாட்கள்',
      card3Label: 'சாதாரண களிம்பு சோதனை தாமதம்',
      card3Desc: 'பாரம்பரிய ஆய்வக சோதனைகளின் முடிவுகள் வர பல நாட்கள் ஆவதால் சிகிச்சை தொடங்குவது தாமதமாகிறது.',
    },
    workflow: {
      tag: 'பரிசோதனை கட்டமைப்பு',
      title: 'நம்பகத்தன்மை முன்னுரிமை கொண்ட 6-படி சரிபார்ப்பு',
      desc: 'SwasthyaScan AI மார்பக எக்ஸ்-ரேக்களை எவ்வாறு மிகக் கவனமாகப் பகுப்பாய்வு செய்கிறது என்பதைக் காணுங்கள்.',
    },
    chatbot: {
      tooltip: 'SwasthyaScan AI-யிடம் கேளுங்கள்',
      assistantBadge: 'உதவியாளர்',
      liveStatus: 'இயங்குகிறது',
      offlineStatus: 'இணைப்பு இல்லை',
      suggestedTitle: 'பரிந்துரைக்கப்பட்ட கேள்விகள்',
      welcome:
        "வணக்கம்! 👋 நான் உங்கள் **SwasthyaScan AI உதவியாளர்**.\n\n" +
        "காசநோய் (TB) அறிகுறிகள், தடுக்கும் முறைகள், மார்பு நலம் மற்றும் SwasthyaScan AI செயல்முறை பற்றி விளக்க நான் தயாராக உள்ளேன்.\n\n" +
        "உங்களுக்கு எவ்வாறு உதவட்டும்?",
      chips: [
        { icon: '🫁', text: 'காசநோய் என்றால் என்ன?' },
        { icon: '⚡', text: 'SwasthyaScan எவ்வாறு செயல்படுகிறது?' },
        { icon: '📋', text: 'முடிவு கொடிகள் (flags) எதை குறிக்கின்றன?' },
        { icon: '🩺', text: 'TB-யின் பொதுவான அறிகுறிகள் என்ன?' },
      ],
      inputPlaceholder: 'காசநோய் அல்லது மார்பு நலம் பற்றிக் கேளுங்கள்… (Enter அழுத்தவும்)',
      hint: 'Enter: அனுப்ப · Shift+Enter: புதிய வரி',
      disclaimer: 'தகவலுக்காக மட்டுமே · இது மருத்துவ முடிவு அல்ல · எந்தத் தகவலும் சேமிக்கப்படாது',
      retry: 'மீண்டும் முயற்சி செய்',
    },
    auth: {
      badge: 'பாதுகாப்பான நோயாளி & மருத்துவர் தளம்',
      title: 'SwasthyaScan AI உள்நுழைக',
      subtitle: 'காசநோய் பரிசோதனை, மருத்துவ அளவீடுகள் மற்றும் AI உதவியாளரை அணுக உள்நுழையவும்.',
      tabPhone: 'மொபைல் (10 இலக்கம்)',
      tabEmail: 'ஜிமெயில் / மின்னஞ்சல்',
      phoneLabel: '10-இலக்க மொபைல் எண்',
      phonePlaceholder: '10 இலக்க எண்ணை உள்ளிடவும்',
      emailLabel: 'மின்னஞ்சல் முகவரி',
      emailPlaceholder: 'எ.கா: yourname@gmail.com',
      sendCode: 'சரிபார்ப்புக் குறியீடு அனுப்பு',
      verifyCode: 'சரிபார்த்து உள்நுழைக',
      enterCode: '6-இலக்க குறியீட்டை உள்ளிடவும்',
      codeSentTo: 'சரிபார்ப்புக் குறியீடு அனுப்பப்பட்டது:',
      resend: 'மீண்டும் அனுப்பு',
      resendIn: 'மீண்டும் அனுப்ப',
      changeNumber: 'மாற்று',
      securityNote: 'முழுமையான தரவு பாதுகாப்பு மற்றும் தனியுரிமை உறுதி செய்யப்பட்டுள்ளது.',
      signOut: 'வெளியேறு',
      welcomeBack: 'வணக்கம்',
    },
  },
  hi: {
    nav: {
      home: 'होम',
      howItWorks: 'यह कैसे काम करता है',
      about: 'हमारे बारे में',
      forDoctors: 'डॉक्टरों के लिए',
      joinCode: 'कोड से जुड़ें',
      startScreening: 'स्क्रीनिंग शुरू करें',
    },
    hero: {
      badge: 'AI टीबी स्क्रीनिंग प्लेटफॉर्म',
      headline1: 'क्या AI तपेदिक (TB) फैलने से पहले',
      headline2: 'उसकी पहचान कर सकता है?',
      subheading:
        'चेस्ट एक्स-रे विश्लेषण, बहु-स्तरीय विश्वसनीयता जांच और डॉक्टर सत्यापन को संयोजित करने वाला एक अत्याधुनिक चिकित्सा AI मंच।',
      ctaScreening: 'स्क्रीनिंग शुरू करें',
      ctaHowItWorks: 'कार्यप्रणाली देखें',
      statTBAffected: '10.6M+',
      statTBAffectedLabel: 'वैश्विक वार्षिक सक्रिय मामले (WHO)',
      statSpeed: '< 2.5 सेकंड',
      statSpeedLabel: 'तेज AI परिणाम और विश्वसनीयता जांच',
    },
    problem: {
      tag: 'चिकित्सीय चुनौती',
      title: 'तपेदिक आज भी एक गंभीर वैश्विक स्वास्थ्य चुनौती है',
      desc: 'समय पर पहचान से जीवन बचता है, लेकिन दूरदराज के क्षेत्रों में परीक्षण की पहुंच एक बड़ी बाधा है।',
      card1Val: '13 लाख+',
      card1Label: 'सालाना होने वाली मौतें',
      card1Desc: 'पूरी तरह से इलाज योग्य होने के बावजूद दुनिया भर में रोजाना 3,500 से अधिक लोग टीबी से जान गंवाते हैं।',
      card2Val: '40% अनदेखे',
      card2Label: 'शुरुआती निदान का अंतर',
      card2Desc: 'विश्व स्तर पर लगभग 40 लाख संक्रमित लोग समय पर जांच के अभाव में छूट जाते हैं।',
      card3Val: '10-14 दिन',
      card3Label: 'मानक कल्चर टेस्ट में देरी',
      card3Desc: 'पारंपरिक प्रयोगशाला परीक्षणों में लगने वाले समय के कारण आवश्यक उपचार शुरू करने में हफ्तों की देरी हो जाती है।',
    },
    workflow: {
      tag: 'स्क्रीनिंग पाइपलाइन',
      title: 'विश्वसनीयता-प्रथम 6-चरणीय सत्यापन',
      desc: 'देखें कि SwasthyaScan AI कैसे चेस्ट एक्स-रे की सटीक गुणवत्ता और विश्वसनीयता जांच करता है।',
    },
    chatbot: {
      tooltip: 'SwasthyaScan AI से पूछें',
      assistantBadge: 'सहायक',
      liveStatus: 'सक्रिय और तैयार',
      offlineStatus: 'सेवा उपलब्ध नहीं',
      suggestedTitle: 'सुझाए गए प्रश्न',
      welcome:
        "नमस्ते! 👋 मैं आपका **SwasthyaScan AI सहायक** हूँ।\n\n" +
        "मैं **तपेदिक (टीबी)** के लक्षण, रोकथाम, फेफड़ों के स्वास्थ्य और इस स्क्रीनिंग प्रोटोटाइप की कार्यप्रणाली समझाने के लिए यहाँ हूँ।\n\n" +
        "आज मैं आपकी क्या सहायता कर सकता हूँ?",
      chips: [
        { icon: '🫁', text: 'टीबी क्या है?' },
        { icon: '⚡', text: 'SwasthyaScan कैसे काम करता है?' },
        { icon: '📋', text: 'रिजल्ट फ्लैग्स का क्या मतलब है?' },
        { icon: '🩺', text: 'टीबी के मुख्य लक्षण क्या हैं?' },
      ],
      inputPlaceholder: 'टीबी या फेफड़ों के स्वास्थ्य के बारे में पूछें… (Enter दबाएं)',
      hint: 'भेजने के लिए Enter · नई पंक्ति के लिए Shift+Enter',
      disclaimer: 'केवल सामान्य स्वास्थ्य जानकारी · यह मेडिकल निदान नहीं है · कोई डेटा सुरक्षित नहीं किया जाता',
      retry: 'पुनः प्रयास करें',
    },
    auth: {
      badge: 'सुरक्षित मरीज और डॉक्टर पोर्टल',
      title: 'SwasthyaScan AI में लॉगिन करें',
      subtitle: 'प्रारंभिक टीबी स्क्रीनिंग, क्लिनिकल मेट्रिक्स और AI सहायक तक पहुँचें।',
      tabPhone: 'मोबाइल (10 अंक)',
      tabEmail: 'जीमेल / ईमेल',
      phoneLabel: '10 अंकों का मोबाइल नंबर',
      phonePlaceholder: '10 अंकों का मोबाइल नंबर दर्ज करें',
      emailLabel: 'ईमेल पता',
      emailPlaceholder: 'उदा: yourname@gmail.com',
      sendCode: 'सत्यापन कोड भेजें',
      verifyCode: 'सत्यापित करें और प्रवेश करें',
      enterCode: '6-अंकीय कोड दर्ज करें',
      codeSentTo: 'सत्यापन कोड भेजा गया:',
      resend: 'पुनः भेजें',
      resendIn: 'पुनः भेजें',
      changeNumber: 'बदलें',
      securityNote: 'सुरक्षित एवं एन्क्रिप्टेड। कोई व्यक्तिगत डेटा साझा नहीं किया जाता।',
      signOut: 'साइन आउट',
      welcomeBack: 'स्वागत है',
    },
  },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('pulmosure_lang') as Language
    return (saved === 'en' || saved === 'ta' || saved === 'hi') ? saved : 'en'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('pulmosure_lang', lang)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: TRANSLATIONS[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

