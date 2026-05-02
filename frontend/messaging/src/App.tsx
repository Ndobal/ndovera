import React, { useState } from 'react';
import MessagingScreen from './features/messaging/components/MessagingScreen';
import HomeScreen from './features/home/components/HomeScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');

  if (currentScreen === 'messaging') {
    return <MessagingScreen onBack={() => setCurrentScreen('home')} />;
  }

  return <HomeScreen onNavigateToMessaging={() => setCurrentScreen('messaging')} />;
}

