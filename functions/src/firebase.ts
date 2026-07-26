import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

export const db = getFirestore();

export const SOURCES = "sources";
export const ITEMS = "items";
export const EVENTS = "events";
