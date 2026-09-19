import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

export const db = getFirestore();

export const SOURCES = "sources";
export const ITEMS = "items";
export const EVENTS = "events";
/** 발행 사건을 바꾸기 전, 승인 PR에 묶어 두는 정정 계획. */
export const EVENT_CORRECTIONS = "eventCorrections";
