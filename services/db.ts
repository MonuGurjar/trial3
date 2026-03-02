
import { FeedbackEntry, User, FeedbackReply, EligibilityData, ChatSession, PlatformFeedback, UserNotification, DocumentMetadata } from '../types';
import {
  saveFeedbackToUpstash,
  fetchFeedbackFromUpstash,
  saveUserToUpstash,
  fetchUsersFromUpstash,
  deleteFeedbackFromUpstash,
  deleteUserFromUpstash,
  fetchChatLogsFromUpstash,
  saveChatSessionToUpstash,
  fetchAdminsFromUpstash,
  saveAdminsToUpstash,
  savePlatformFeedbackToUpstash,
  fetchPlatformFeedbackFromUpstash
} from './kv';

// Re-export for components that need direct access to fresh data
export { fetchUsersFromUpstash, saveChatSessionToUpstash };

// --- AUTH TOKEN MANAGEMENT ---

const AUTH_TOKEN_KEY = 'mr_auth_token';

export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const FEEDBACK_KEY = 'med_russia_feedback_data';
const USERS_KEY = 'med_russia_users_data';

const getLocal = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  if (!data) return [];
  try { return JSON.parse(data); } catch { return []; }
};

// --- HELPER: Get Admins (KV only) ---
const getAdminsSafe = async (): Promise<User[]> => {
  const admins = await fetchAdminsFromUpstash();
  return admins || [];
};

export const registerUser = async (user: Omit<User, 'id'>): Promise<User> => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });

  if (!response.ok) {
    let errorMsg = 'Registration failed';
    try {
      const error = await response.json();
      errorMsg = error.error || errorMsg;
    } catch {
      // Response was not JSON (e.g. HTML error page)
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const newUser = data.user;
  const token = data.token;

  // Save JWT token
  if (token) {
    setAuthToken(token);
  }

  // Save to Local Storage as cache
  const localUsers = getLocal<User>(USERS_KEY);
  localUsers.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));

  return newUser;
};

export const updateUser = async (user: User): Promise<void> => {
  if (user.role === 'admin') {
    const admins = await getAdminsSafe();
    const index = admins.findIndex(a => a.id === user.id);
    if (index !== -1) {
      admins[index] = user;
      await saveAdminsToUpstash(admins);
    }
  } else {
    // Update Local
    const localUsers = getLocal<User>(USERS_KEY);
    const index = localUsers.findIndex(u => u.id === user.id);
    if (index !== -1) {
      localUsers[index] = user;
    } else {
      localUsers.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));

    // Update Cloud
    await saveUserToUpstash(user);
  }
};

export const sendNotificationToUser = async (userId: string, notification: Omit<UserNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void> => {
  const users = await fetchUsersFromUpstash();
  const index = users.findIndex((u: any) => u.id === userId);

  if (index === -1) throw new Error("User not found");

  const user = users[index];
  if (!user.notifications) user.notifications = [];

  const newNotification: UserNotification = {
    ...notification,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    isRead: false
  };

  // Add to beginning of list
  user.notifications.unshift(newNotification);

  // Save Cloud
  await saveUserToUpstash(user);

  // Save Local (if current session matches)
  const localUsers = getLocal<User>(USERS_KEY);
  const localIdx = localUsers.findIndex(u => u.id === userId);
  if (localIdx !== -1) {
    localUsers[localIdx] = user;
    localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
  }
};

export const loginUser = async (email: string, password?: string): Promise<User | null> => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const user = data.user;
    const token = data.token;

    // Save JWT token
    if (token) {
      setAuthToken(token);
    }

    return user;
  } catch (e) {
    console.error("Login failed", e);
    return null;
  }
};

// --- PASSWORD RECOVERY (Server-side — passwords stored as plain text) ---

export const getSecurityQuestion = async (email: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_question', email }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.question || null;
  } catch (e) {
    console.error('Failed to get security question', e);
    return null;
  }
};

export const resetPassword = async (email: string, answer: string, newPassword: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', email, answer, newPassword }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Reset failed');
    }

    return true;
  } catch (e: any) {
    console.error('Password reset failed:', e.message);
    return false;
  }
};

// --- DOCUMENTS ---

export const updateUserDocuments = async (userId: string, docType: 'marksheet' | 'passport' | 'neetScoreCard', metadata: DocumentMetadata): Promise<User> => {
  const users = getLocal<User>(USERS_KEY);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) throw new Error("User not found");

  // 2. Update Document
  const user = users[userIndex];
  if (!user.documents) user.documents = {};

  user.documents[docType] = metadata;

  // 3. Save Local
  users[userIndex] = user;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 4. Update Active Session
  const currentUser = JSON.parse(localStorage.getItem('mr_active_user') || '{}');
  if (currentUser.id === userId) {
    localStorage.setItem('mr_active_user', JSON.stringify(user));
  }

  await saveUserToUpstash(user);

  return user;
};

export const removeUserDocument = async (userId: string, docType: 'marksheet' | 'passport' | 'neetScoreCard'): Promise<User> => {
  const users = await fetchUsersFromUpstash();
  const userIndex = users.findIndex((u: any) => u.id === userId);

  if (userIndex === -1) throw new Error("User not found");

  const user = users[userIndex];
  if (user.documents && user.documents[docType]) {
    delete user.documents[docType];

    await saveUserToUpstash(user);

    // Sync Local
    const localUsers = getLocal<User>(USERS_KEY);
    const localIdx = localUsers.findIndex(u => u.id === userId);
    if (localIdx !== -1) {
      localUsers[localIdx] = user;
      localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
    }
    return user;
  }
  return user;
};

// New Function for Admin Verification
export const verifyUserDocument = async (userId: string, docType: 'marksheet' | 'passport' | 'neetScoreCard', status: 'verified' | 'rejected', remarks?: string): Promise<User> => {
  const users = await fetchUsersFromUpstash();
  const userIndex = users.findIndex((u: any) => u.id === userId);

  if (userIndex === -1) throw new Error("User not found in cloud");

  const user = users[userIndex];
  if (user.documents && user.documents[docType]) {
    user.documents[docType].status = status;
    if (remarks) user.documents[docType].remarks = remarks;

    await saveUserToUpstash(user);

    // Update Local if it's the current user (edge case, but good to handle)
    const localUsers = getLocal<User>(USERS_KEY);
    const localIdx = localUsers.findIndex(u => u.id === userId);
    if (localIdx !== -1) {
      localUsers[localIdx] = user;
      localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
    }

    return user;
  }
  throw new Error("Document not found");
}

export const updateUserEligibility = async (userId: string, data: EligibilityData, result: string): Promise<User> => {
  const users = getLocal<User>(USERS_KEY);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) throw new Error("User not found");

  const user = users[userIndex];
  user.eligibilityData = data;
  user.eligibilityResult = result;

  users[userIndex] = user;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const currentUser = JSON.parse(localStorage.getItem('mr_active_user') || '{}');
  if (currentUser.id === userId) {
    localStorage.setItem('mr_active_user', JSON.stringify(user));
  }

  await saveUserToUpstash(user);
  return user;
};

export const toggleShortlist = (userId: string, uniName: string): string[] => {
  const users = getLocal<User>(USERS_KEY);
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx === -1) return [];

  const user = users[userIdx];
  const list = user.shortlistedUniversities || [];
  const exists = list.indexOf(uniName);

  if (exists > -1) {
    list.splice(exists, 1);
  } else {
    list.push(uniName);
  }

  user.shortlistedUniversities = list;
  users[userIdx] = user;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return list;
};

// Uses JWT auth header instead of trusting requesterId
export const getAllAdmins = async (): Promise<User[]> => {
  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type: 'admins' })
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    console.error("Failed to fetch admins", e);
    return [];
  }
};

// Uses JWT auth header instead of trusting requesterId
export const getAllStudents = async (): Promise<User[]> => {
  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type: 'students' })
    });

    if (!response.ok) {
      console.error("Failed to fetch students:", response.statusText);
      return [];
    }

    const users: User[] = await response.json();
    return users.filter((u: any) => u.role === 'student');
  } catch (e) {
    console.error("Failed to fetch students via API", e);
    return [];
  }
};

export const syncUsers = async (): Promise<void> => {
  try {
    const cloudUsers = await fetchUsersFromUpstash();
    if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(cloudUsers));
    }
  } catch (e) {
    console.error("Failed to sync users", e);
  }
};

export const saveFeedback = async (entry: Omit<FeedbackEntry, 'id' | 'timestamp' | 'replies' | 'status'>): Promise<FeedbackEntry> => {
  const users = getLocal<User>(USERS_KEY);

  let userId = entry.userId;
  if (!userId) {
    const matchedUser = users.find(u =>
      u.role === 'student' &&
      (u.email.toLowerCase() === entry.email.toLowerCase() ||
        (u.phone && entry.phone && u.phone.replace(/\D/g, '') === entry.phone.replace(/\D/g, '')))
    );
    if (matchedUser) userId = matchedUser.id;
  }

  const newEntry: FeedbackEntry = {
    ...entry,
    userId: userId,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    replies: [],
    status: 'pending'
  };

  const localEntries = getLocal<FeedbackEntry>(FEEDBACK_KEY);
  localEntries.push(newEntry);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(localEntries));

  // Sync to Cloud
  await saveFeedbackToUpstash(newEntry);
  return newEntry;
};

export const addReply = async (feedbackId: string, reply: Omit<FeedbackReply, 'id' | 'timestamp'>): Promise<void> => {
  const entries = await getAllFeedback();
  const index = entries.findIndex(e => e.id === feedbackId);

  if (index !== -1) {
    const newReply: FeedbackReply = {
      ...reply,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    entries[index].replies.push(newReply);
    entries[index].status = 'replied';

    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
    await saveFeedbackToUpstash(entries[index]);
  }
};

export const getUserFeedback = async (userId: string): Promise<FeedbackEntry[]> => {
  const all = await getAllFeedback();
  return all.filter(f => f.userId === userId);
};

export const getAllFeedback = async (): Promise<FeedbackEntry[]> => {
  const { entries: remoteEntries } = await fetchFeedbackFromUpstash();
  const localEntries = getLocal<FeedbackEntry>(FEEDBACK_KEY);

  if (remoteEntries.length === 0) return localEntries;

  const merged = [...remoteEntries];
  localEntries.forEach(local => {
    if (!merged.find(remote => remote.id === local.id)) {
      merged.push(local);
    }
  });

  return merged.sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteFeedback = async (id: string): Promise<void> => {
  // 1. Delete from Local Storage (Instant UI update)
  const entries = getLocal<FeedbackEntry>(FEEDBACK_KEY);
  const newEntries = entries.filter(e => e.id !== id);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(newEntries));

  // 2. Delete from Cloud
  await deleteFeedbackFromUpstash(id);
};

export const deleteUser = async (email: string): Promise<void> => {
  // Check if it's an admin first
  const admins = await getAdminsSafe();
  const adminIndex = admins.findIndex(a => a.email === email);

  if (adminIndex !== -1) {
    const updatedAdmins = admins.filter(a => a.email !== email);
    await saveAdminsToUpstash(updatedAdmins);
    return;
  }

  // 1. Delete from Local Storage
  const users = getLocal<User>(USERS_KEY);
  const newUsers = users.filter(u => u.email !== email);
  localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));

  // 2. Delete from Cloud
  await deleteUserFromUpstash(email);
};

// --- CHAT LOGGING ---

export const logChatSession = async (session: ChatSession): Promise<void> => {
  // Only save to Cloud to save local storage space, as these are logs
  await saveChatSessionToUpstash(session);
};

export const getChatHistory = async (): Promise<ChatSession[]> => {
  return await fetchChatLogsFromUpstash();
};

export const deleteChatSession = async (id: string): Promise<void> => {
  const sessions = await fetchChatLogsFromUpstash();
  const newSessions = sessions.filter(s => s.id !== id);
  // Use the KV helper to save the filtered array (implemented as overload in KV)
  await saveChatSessionToUpstash(newSessions);
};

// --- PLATFORM FEEDBACK (HUB) ---

export const savePlatformFeedback = async (feedback: Omit<PlatformFeedback, 'id' | 'timestamp' | 'status'>): Promise<PlatformFeedback> => {
  const newFeedback: PlatformFeedback = {
    ...feedback,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    status: 'new'
  };
  await savePlatformFeedbackToUpstash(newFeedback);
  return newFeedback;
};

export const getAllPlatformFeedback = async (): Promise<PlatformFeedback[]> => {
  const feedback = await fetchPlatformFeedbackFromUpstash();
  return feedback.sort((a, b) => b.timestamp - a.timestamp);
};

export const updatePlatformFeedbackStatus = async (id: string, status: 'new' | 'reviewed'): Promise<void> => {
  const all = await fetchPlatformFeedbackFromUpstash();
  const item = all.find(f => f.id === id);
  if (item) {
    item.status = status;
    await savePlatformFeedbackToUpstash(item);
  }
};
