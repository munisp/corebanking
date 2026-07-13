import { useEffect } from "react";
import { useLocation } from "wouter";

// /swift-messaging is a legacy path — canonical route is /swift-messages (SWIFTMessagesWorkspace).
// This shim redirects any direct URL access or bookmark to the canonical route.
export default function SwiftMessagingWorkspace() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/swift-messages"); }, []);
  return null;
}
