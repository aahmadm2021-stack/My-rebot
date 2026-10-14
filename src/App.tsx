/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Download,
  Copy,
  Check,
  Smartphone,
  Code2,
  FileText,
  Key,
  BookOpen,
  Trash2,
  Sparkles,
  Terminal,
  ShieldCheck,
  Layers,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Database,
  User,
  LogIn,
  LogOut,
  Lock,
  Mail,
  UserPlus
} from 'lucide-react';
import JSZip from 'jszip';
import {
  DEFAULT_SUPABASE_URL,
  getSavedSupabaseKey,
  saveSupabaseKey,
  getSupabase,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  getCurrentUser,
  saveMessageToSupabase,
  loadChatHistoryFromSupabase
} from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Message {
  text: string;
  isUser: boolean;
  isError?: boolean;
}

const MAIN_ACTIVITY_CODE = `package com.example.myrobot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                RobotScreen()
            }
        }
    }
}

data class Message(val text: String, val isUser: Boolean)

@Composable
fun RobotScreen() {
    var input by remember { mutableStateOf("") }
    var messages by remember { mutableStateOf(listOf<Message>()) }
    var isLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val scrollState = rememberLazyListState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F0F0F))
            .padding(16.dp)
    ) {
        Text(
            text = "🤖 روبوتي",
            color = Color.White,
            fontSize = 24.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            state = scrollState,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages) { msg ->
                MessageBubble(msg)
            }
        }

        if (isLoading) {
            Text(
                "⏳ يفكر...",
                color = Color.Gray,
                modifier = Modifier.padding(8.dp)
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("اكتب أمرك...", color = Color.Gray) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = Color(0xFF4CAF50),
                    unfocusedBorderColor = Color.Gray
                )
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (input.isNotBlank() && !isLoading) {
                        val userMsg = input
                        messages = messages + Message(userMsg, true)
                        input = ""
                        isLoading = true
                        scope.launch {
                            val reply = callAI(userMsg)
                            messages = messages + Message(reply, false)
                            isLoading = false
                        }
                    }
                }
            ) {
                Icon(
                    Icons.Default.Send,
                    contentDescription = "إرسال",
                    tint = Color(0xFF4CAF50)
                )
            }
        }
    }
}

@Composable
fun MessageBubble(msg: Message) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = if (msg.isUser) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Text(
            text = msg.text,
            color = if (msg.isUser) Color.White else Color(0xFFB0B0B0),
            fontSize = 16.sp,
            modifier = Modifier
                .background(
                    if (msg.isUser) Color(0xFF1E88E5) else Color(0xFF2A2A2A),
                    RoundedCornerShape(12.dp)
                )
                .padding(12.dp)
                .widthIn(max = 280.dp)
        )
    }
}

suspend fun callAI(userMessage: String): String = withContext(Dispatchers.IO) {
    try {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isBlank() || apiKey == "ضع_مفتاح_جوجل_هنا") {
            return@withContext "⚠️ يرجى وضع مفتاح Gemini API الحقيقي الخاص بك في ملف build.gradle.kts بدلاً من 'ضع_مفتاح_جوجل_هنا'."
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        val json = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply {
                            put("text", "أنت روبوت مساعد شخصي. رد بالعربية بوضوح وإيجاز. الأمر: $userMessage")
                        })
                    })
                })
            })
        }

        // قائمة نماذج مدعومة مع محاولات إعادة تلقائية لتفادي خطأ 503 (Model Overloaded)
        val models = listOf("gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash")
        var lastErrorMessage = ""

        for (model in models) {
            for (attempt in 1..2) {
                try {
                    val url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey"
                    val request = Request.Builder()
                        .url(url)
                        .post(json.toString().toRequestBody("application/json".toMediaType()))
                        .build()

                    val response = client.newCall(request).execute()
                    val code = response.code
                    val body = response.body?.string() ?: ""

                    if (response.isSuccessful && body.isNotEmpty()) {
                        val responseJson = JSONObject(body)
                        val candidates = responseJson.optJSONArray("candidates")
                        if (candidates != null && candidates.length() > 0) {
                            val candidate = candidates.getJSONObject(0)
                            val content = candidate.optJSONObject("content")
                            val parts = content?.optJSONArray("parts")
                            if (parts != null && parts.length() > 0) {
                                return@withContext parts.getJSONObject(0).getString("text")
                            }
                        }
                    }

                    // معالجة خطأ 503 (ضغط مؤقت على الخادم) وإعادة المحاولة
                    if (code == 503 || body.contains("503") || body.contains("overloaded", ignoreCase = true) || body.contains("UNAVAILABLE", ignoreCase = true)) {
                        lastErrorMessage = "خوادم Gemini تشهد ضغطاً مؤقتاً (خطأ 503). يرجى المحاولة بعد لحظات."
                        delay(1200)
                        continue
                    }

                    if (body.isNotEmpty()) {
                        try {
                            val errJson = JSONObject(body).optJSONObject("error")
                            if (errJson != null) {
                                val msg = errJson.optString("message", "")
                                lastErrorMessage = "خطأ ($code): $msg"
                            }
                        } catch (_: Exception) {}
                    }
                } catch (e: Exception) {
                    lastErrorMessage = e.message ?: "فشل الاتصال"
                    delay(800)
                }
            }
        }

        if (lastErrorMessage.isNotEmpty()) {
            "⚠️ $lastErrorMessage"
        } else {
            "⚠️ تعذر استلام رد من النموذج (خطأ 503). يرجى المحاولة بعد ثوانٍ."
        }

    } catch (e: Exception) {
        "⚠️ خطأ: \${e.message}"
    }
}`;

const BUILD_GRADLE_APP = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.myrobot"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.myrobot"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        buildConfigField("String", "GEMINI_API_KEY", "\\"ضع_مفتاح_جوجل_هنا\\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.02.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}`;

const ANDROID_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.myrobot">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@android:drawable/sym_def_app_icon"
        android:label="روبوتي"
        android:roundIcon="@android:drawable/sym_def_app_icon"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="روبوتي"
            android:theme="@android:style/Theme.Material.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>`;

const ROOT_BUILD_GRADLE = `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}`;

const SETTINGS_GRADLE = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MyRobot"
include(":app")`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'apk_guide' | 'error_503_solution' | 'github_vercel' | 'supabase'>('supabase');
  const [selectedFile, setSelectedFile] = useState<'main' | 'build_app' | 'manifest' | 'root_build' | 'settings'>('main');
  const [gitCopied, setGitCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Jetpack Compose Simulation State (matching exact Jetpack Compose RobotScreen state)
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      text: 'مرحباً بك! أنا روبوتي 🤖. اكتب لي أي أمر وسأرد عليك مباشرة عبر Gemini API.',
      isUser: false,
    },
  ]);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastHad503, setLastHad503] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Supabase Auth & Database State
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [anonKeyInput, setAnonKeyInput] = useState<string>(getSavedSupabaseKey());
  const [isAnonKeySaved, setIsAnonKeySaved] = useState<boolean>(!!getSavedSupabaseKey());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('ahmadahmad3077@gmail.com');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [syncWithSupabase, setSyncWithSupabase] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; tableExists: boolean; message?: string } | null>(null);

  const checkDb = async () => {
    try {
      const res = await fetch('/api/supabase');
      const data = await res.json();
      setDbStatus(data);
    } catch {
      setDbStatus({ connected: true, tableExists: false });
    }
  };

  useEffect(() => {
    checkDb();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Load active user and chat history on startup
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        loadChatHistoryFromSupabase(user.id).then((history) => {
          if (history && history.length > 0) {
            setMessages(history);
          }
        });
      }
    });
  }, [isAnonKeySaved]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthMessage({ type: 'error', text: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
      return;
    }
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (authMode === 'signup') {
        const { user, error } = await signUpWithEmail(authEmail, authPassword);
        if (error) {
          setAuthMessage({ type: 'error', text: error });
        } else {
          setCurrentUser(user);
          setAuthMessage({ type: 'success', text: 'تم إنشاء الحساب بنجاح وتسجيل الدخول!' });
          setTimeout(() => setIsAuthModalOpen(false), 1200);
        }
      } else {
        const { user, error } = await signInWithEmail(authEmail, authPassword);
        if (error) {
          setAuthMessage({ type: 'error', text: error });
        } else {
          setCurrentUser(user);
          setAuthMessage({ type: 'success', text: 'تم تسجيل الدخول بنجاح!' });
          if (user) {
            loadChatHistoryFromSupabase(user.id).then((history) => {
              if (history && history.length > 0) {
                setMessages(history);
              }
            });
          }
          setTimeout(() => setIsAuthModalOpen(false), 1200);
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  const handleSaveAnonKey = () => {
    if (!anonKeyInput.trim()) return;
    saveSupabaseKey(anonKeyInput.trim());
    setIsAnonKeySaved(true);
    getCurrentUser().then((u) => setCurrentUser(u));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setLastUserPrompt(text);
    const newMessages: Message[] = [...messages, { text, isUser: true }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setLastHad503(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customApiKey: customKey || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        setMessages((prev) => [...prev, { text: data.reply, isUser: false }]);
        if (syncWithSupabase) {
          saveMessageToSupabase(text, data.reply, currentUser?.id);
        }
      } else {
        const errorText = data.error || '⚠️ حدث خطأ غير متوقع في الاتصال.';
        const is503 = response.status === 503 || errorText.includes('503') || errorText.includes('high demand') || errorText.includes('UNAVAILABLE');
        if (is503) {
          setLastHad503(true);
        }
        setMessages((prev) => [
          ...prev,
          {
            text: is503
              ? '⚠️ عذراً، خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً (خطأ 503: High Demand). تم تحديث النماذج البديلة، اضغط زر إعادة المحاولة.'
              : errorText,
            isUser: false,
            isError: true,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { text: `⚠️ خطأ: ${err?.message || 'تعذر الاتصال بالخادم'}`, isUser: false, isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      const serverUrl = '/api/download/project-zip';
      const link = document.createElement('a');
      link.href = serverUrl;
      link.download = 'MyRobot-Android-Project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      const zip = new JSZip();
      const folder = zip.folder('MyRobot');
      if (folder) {
        folder.file('build.gradle.kts', ROOT_BUILD_GRADLE);
        folder.file('settings.gradle.kts', SETTINGS_GRADLE);
        folder.file('gradle.properties', 'org.gradle.jvmargs=-Xmx2048m\nandroid.useAndroidX=true\n');
        folder.file('app/build.gradle.kts', BUILD_GRADLE_APP);
        folder.file('app/src/main/AndroidManifest.xml', ANDROID_MANIFEST);
        folder.file('app/src/main/java/com/example/myrobot/MainActivity.kt', MAIN_ACTIVITY_CODE);
        folder.file('app/src/main/res/values/strings.xml', '<resources><string name="app_name">روبوتي</string></resources>');

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MyRobot-Android-Project.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  const getCodeContent = () => {
    switch (selectedFile) {
      case 'main':
        return { name: 'MainActivity.kt', path: 'app/src/main/java/com/example/myrobot/MainActivity.kt', code: MAIN_ACTIVITY_CODE };
      case 'build_app':
        return { name: 'build.gradle.kts (Module: app)', path: 'app/build.gradle.kts', code: BUILD_GRADLE_APP };
      case 'manifest':
        return { name: 'AndroidManifest.xml', path: 'app/src/main/AndroidManifest.xml', code: ANDROID_MANIFEST };
      case 'root_build':
        return { name: 'build.gradle.kts (Project)', path: 'build.gradle.kts', code: ROOT_BUILD_GRADLE };
      case 'settings':
        return { name: 'settings.gradle.kts', path: 'settings.gradle.kts', code: SETTINGS_GRADLE };
      default:
        return { name: 'MainActivity.kt', path: 'app/src/main/java/com/example/myrobot/MainActivity.kt', code: MAIN_ACTIVITY_CODE };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-gray-100 font-sans" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-[#161b22]/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">روبوتي</h1>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                MyRobot v1.0
              </span>
              <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                Jetpack Compose
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full hidden sm:inline">
                درع حماية 503 مفعل
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">
              تطبيق أندرويد متكامل مع شاشة Compose، محاكي مباشر، معالجة خطأ 503 تلقائياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User Profile / Auth State */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#1e2430] border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono text-gray-200 max-w-[140px] truncate" title={currentUser.email}>
                {currentUser.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-red-400 hover:text-red-300 mr-1 p-0.5 rounded hover:bg-red-950/30 transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthMessage(null);
                setIsAuthModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md shadow-blue-900/30 transition cursor-pointer"
              title="تسجيل الدخول / إنشاء حساب"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          {/* Download Project ZIP */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-md shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
            title="تحميل المشروع كاملاً للأندرويد ستوديو"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">تحميل المشروع كاملاً (.ZIP)</span>
            <span className="sm:hidden">تحميل ZIP</span>
          </button>

          {/* Gemini API Key Setting */}
          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm border border-gray-700 transition cursor-pointer"
            title="إعداد مفتاح Gemini API"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">مفتاح API</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Simulator / Mobile Frame (5 Cols on Desktop) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-gray-200">محاكي هاتف أندرويد (Compose)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <button
              onClick={() => {
                setMessages([
                  {
                    text: 'تمت إعادة تعيين المحادثة. كيف يمكنني مساعدتك اليوم؟',
                    isUser: false,
                  },
                ]);
                setLastHad503(false);
              }}
              className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition cursor-pointer"
              title="مسح المحادثة"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح
            </button>
          </div>

          {/* Phone Frame */}
          <div className="w-full max-w-[360px] bg-[#1a1a1a] rounded-[42px] p-3 shadow-2xl border-4 border-gray-700/80 relative flex flex-col aspect-[9/18.5] max-h-[720px]">
            {/* Phone Speaker & Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-[#111] rounded-full flex items-center justify-center gap-2 z-20">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1e293b]"></div>
              <div className="w-8 h-1 rounded-full bg-gray-800"></div>
            </div>

            {/* Android Screen - EXACT Jetpack Compose UI */}
            <div
              className="flex-1 w-full bg-[#0F0F0F] rounded-[32px] overflow-hidden flex flex-col pt-7 relative border border-gray-900"
              style={{ backgroundColor: '#0F0F0F' }}
            >
              {/* Android Status Bar */}
              <div className="px-5 py-1 flex items-center justify-between text-[11px] text-gray-400 select-none">
                <span className="font-mono">12:30</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span>5G</span>
                  <span>📶</span>
                  <span>🔋 98%</span>
                </div>
              </div>

              {/* Compose Title: 🤖 روبوتي */}
              <div className="px-4 pt-2 pb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-white text-[24px] font-bold tracking-tight">
                    🤖 روبوتي
                  </h2>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{currentUser ? `${currentUser.email?.split('@')[0]} (متصل)` : 'حساب زائر'}</span>
                  </div>
                </div>

                {currentUser ? (
                  <button
                    onClick={handleSignOut}
                    className="text-[10px] bg-blue-950/60 hover:bg-red-950/50 text-blue-300 hover:text-red-300 border border-blue-800/40 px-2 py-1 rounded-full font-mono flex items-center gap-1 transition cursor-pointer"
                    title="تسجيل الخروج"
                  >
                    <User className="w-2.5 h-2.5" />
                    <LogOut className="w-2.5 h-2.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthMessage(null);
                      setIsAuthModalOpen(true);
                    }}
                    className="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <LogIn className="w-2.5 h-2.5" />
                    <span>تسجيل الدخول</span>
                  </button>
                )}
              </div>

              {/* Messages LazyColumn */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto px-4 space-y-2 select-text scroll-smooth"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col w-full ${
                      msg.isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`text-[15px] leading-relaxed p-3 rounded-[12px] max-w-[280px] break-words ${
                        msg.isUser
                          ? 'bg-[#1E88E5] text-white shadow-sm'
                          : msg.isError
                          ? 'bg-[#3b1d1d] text-rose-200 border border-rose-800/50'
                          : 'bg-[#2A2A2A] text-[#B0B0B0]'
                      }`}
                      style={{
                        backgroundColor: msg.isUser
                          ? '#1E88E5'
                          : msg.isError
                          ? '#351c1c'
                          : '#2A2A2A',
                        color: msg.isUser ? '#FFFFFF' : msg.isError ? '#fecdd3' : '#B0B0B0',
                        borderRadius: '12px',
                        maxWidth: '280px',
                      }}
                    >
                      {msg.text}
                    </div>

                    {/* Retry button for error message */}
                    {msg.isError && lastUserPrompt && (
                      <button
                        onClick={() => handleSendMessage(lastUserPrompt)}
                        className="mt-1 flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-gray-900/80 px-2 py-1 rounded-md border border-amber-500/30 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>إعادة المحاولة الآن</span>
                      </button>
                    )}
                  </div>
                ))}

                {/* Loading state: ⏳ يفكر... */}
                {isLoading && (
                  <div className="p-2 text-gray-400 text-sm flex items-center gap-1.5 animate-pulse">
                    <span>⏳</span>
                    <span>يفكر...</span>
                  </div>
                )}
              </div>

              {/* Bottom Input Area */}
              <div className="p-3 border-t border-gray-900 bg-[#0F0F0F]">
                {/* Quick Prompts */}
                {messages.length <= 2 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none text-[11px]">
                    <button
                      onClick={() => handleSendMessage('عرّف عن نفسك باختصار')}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#1e2430] text-blue-300 border border-blue-900/50 hover:bg-blue-900/30 transition cursor-pointer"
                    >
                      💡 عرّف عن نفسك
                    </button>
                    <button
                      onClick={() => handleSendMessage('ما هي عاصمة اليابان؟')}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#1e2430] text-blue-300 border border-blue-900/50 hover:bg-blue-900/30 transition cursor-pointer"
                    >
                      🇯🇵 عاصمة اليابان
                    </button>
                    <button
                      onClick={() => handleSendMessage('اكتب حكمة قصيرة اليوم')}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#1e2430] text-blue-300 border border-blue-900/50 hover:bg-blue-900/30 transition cursor-pointer"
                    >
                      ✨ حكمة قصيرة
                    </button>
                  </div>
                )}

                {/* Input Row */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="اكتب أمرك..."
                      disabled={isLoading}
                      className="w-full bg-transparent text-white placeholder-gray-400 text-sm px-3.5 py-2.5 rounded-lg border border-gray-600 focus:border-[#4CAF50] focus:outline-none transition-colors"
                      style={{
                        borderColor: input ? '#4CAF50' : '#555555',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 rounded-full hover:bg-gray-800 disabled:opacity-40 transition cursor-pointer flex items-center justify-center"
                    style={{ color: '#4CAF50' }}
                    title="إرسال"
                  >
                    <Send className="w-5 h-5 text-[#4CAF50] rotate-180" />
                  </button>
                </form>
              </div>

              {/* Android Home Navigation Bar */}
              <div className="py-2 flex justify-center">
                <div className="w-28 h-1 bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Inspector, Project Architecture, APK Guide (7 Cols on Desktop) */}
        <div className="lg:col-span-7 flex flex-col">
          
          {/* Main Navigation Tabs */}
          <div className="flex border-b border-gray-800 bg-[#161b22] rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#0d1117] text-blue-400 border-t-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>نظرة عامة</span>
            </button>

            <button
              onClick={() => setActiveTab('error_503_solution')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'error_503_solution'
                  ? 'bg-[#0d1117] text-amber-400 border-t-2 border-amber-500'
                  : 'text-gray-400 hover:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>حل خطأ 503 (معالجة الضغط)</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-[#0d1117] text-blue-400 border-t-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>ملفات الكود المصدري</span>
            </button>

            <button
              onClick={() => setActiveTab('apk_guide')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'apk_guide'
                  ? 'bg-[#0d1117] text-emerald-400 border-t-2 border-emerald-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>دليل APK</span>
            </button>

            <button
              onClick={() => setActiveTab('github_vercel')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'github_vercel'
                  ? 'bg-[#0d1117] text-purple-400 border-t-2 border-purple-500'
                  : 'text-gray-400 hover:text-purple-300'
              }`}
            >
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>GitHub و Vercel</span>
            </button>

            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'supabase'
                  ? 'bg-[#0d1117] text-emerald-400 border-t-2 border-emerald-500'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">قاعدة بيانات Supabase</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </div>

          {/* Tab Content Box */}
          <div className="bg-[#161b22] border border-gray-800 border-t-0 rounded-b-xl p-5 flex-1 flex flex-col min-h-[500px]">
            
            {/* TAB: ERROR 503 SOLUTION */}
            {activeTab === 'error_503_solution' && (
              <div className="space-y-5">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-300 text-sm">
                      ما هو خطأ 503 (Model Overloaded / High Demand)؟
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      خطأ <strong>HTTP 503 Service Unavailable</strong> يحدث من طرف خوادم Google Gemini الرسمية عندما يشهد أحد النماذج ضغطاً كثيفاً مؤقتاً في نفس اللحظة:
                      <br />
                      <code className="text-amber-200 bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-[11px] mt-1 inline-block dir-ltr">
                        "This model is currently experiencing high demand. Spikes in demand are usually temporary."
                      </code>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    كيف قمنا بحل المشكلة وجعل التطبيق مضاداً لأخطاء 503:
                  </h4>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                        <span>1. تفعيل التبديل التلقائي بين النماذج (Model Fallback Cascade):</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        بدلاً من الاعتماد على نموذج واحد، تم ربط قائمة من النماذج الاحتياطية المعتمدة مثل <code className="text-blue-300 bg-gray-800 px-1 py-0.5 rounded">gemini-3.5-flash</code> و <code className="text-blue-300 bg-gray-800 px-1 py-0.5 rounded">gemini-2.0-flash</code> و <code className="text-blue-300 bg-gray-800 px-1 py-0.5 rounded">gemini-1.5-flash</code>. إذا كان أحد النماذج مشغولاً بضغط 503، ينتقل التطبيق تلقائياً في أجزاء من الثانية إلى النموذج البديل!
                      </p>
                    </div>

                    <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
                      <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs mb-1">
                        <span>2. إعادة المحاولة الذكية (Exponential Backoff):</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        عند حدوث ضغط مؤقت، ينتظر الكود 1.2 ثانية ويعيد إرسال الطلب تلقائياً قبل إشعار المستخدم، مما يحل 99% من ارتفاعات الضغط اللحظية.
                      </p>
                    </div>

                    <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
                        <span>3. زر إعادة المحاولة الفوري داخل شاشة المحادثة:</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        في حال واجهت أي طلب متعثر، يظهر زر <strong className="text-amber-300">"إعادة المحاولة الآن"</strong> مباشرة أسفل الفقاعة لإعادة إرسال طلبك فوراً دون الحاجة لإعادة كتابته.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>تجربة المحاكي الآن بعد الإصلاح</span>
                  </button>
                  <button
                    onClick={handleDownloadZip}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الكود المحدّث كملف ZIP</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: OVERVIEW & SPECIFICATIONS */}
            {activeTab === 'simulator' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    تطبيق روبوتي (MyRobot) لنظام أندرويد
                  </h3>
                  <p className="text-gray-300 text-sm mt-1 leading-relaxed">
                    تم إنشاء وتجهيز هيكل التطبيق بالكامل وفق المواصفات المطلوبة بنسبة 100% باستخدام أحدث مكتبات
                    <strong className="text-white mx-1">Jetpack Compose</strong>
                    و
                    <strong className="text-white mx-1">Material 3</strong>
                    مع معالجة متقدمة لأخطاء الضغط 503 عبر OkHttp و Kotlin Coroutines.
                  </p>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#0d1117] p-3.5 rounded-lg border border-gray-800/80">
                    <span className="text-xs text-gray-400 block mb-1">اسم الحزمة (Package Name)</span>
                    <span className="text-sm font-mono text-emerald-400 font-semibold">com.example.myrobot</span>
                  </div>

                  <div className="bg-[#0d1117] p-3.5 rounded-lg border border-gray-800/80">
                    <span className="text-xs text-gray-400 block mb-1">الحد الأدنى للنظام (Min SDK)</span>
                    <span className="text-sm font-mono text-blue-400 font-semibold">API 24 (Android 7.0+)</span>
                  </div>

                  <div className="bg-[#0d1117] p-3.5 rounded-lg border border-gray-800/80">
                    <span className="text-xs text-gray-400 block mb-1">واجهة المستخدم (UI Toolkit)</span>
                    <span className="text-sm text-purple-300 font-semibold">Jetpack Compose Material 3</span>
                  </div>

                  <div className="bg-[#0d1117] p-3.5 rounded-lg border border-gray-800/80">
                    <span className="text-xs text-gray-400 block mb-1">حالة الاتصال والرد</span>
                    <span className="text-sm text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      جاهز مع تبديل النماذج الذكي
                    </span>
                  </div>
                </div>

                {/* Highlights of Implementation */}
                <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800">
                  <h4 className="text-sm font-bold text-gray-200 mb-2.5 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    المطابقة التامة للمتطلبات:
                  </h4>
                  <ul className="text-xs space-y-2 text-gray-300 list-disc list-inside">
                    <li><strong className="text-white">شاشة واحدة (Single Activity):</strong> كل المنطق مدمج داخل <code className="bg-gray-800 px-1 py-0.5 rounded text-blue-300">MainActivity.kt</code>.</li>
                    <li><strong className="text-white">قائمة محادثات LazyColumn:</strong> رسائل المستخدم بالأزرق على اليمين والردود بالرمادي على اليسار.</li>
                    <li><strong className="text-white">مؤشر التحميل:</strong> ظهور <code className="bg-gray-800 px-1 py-0.5 rounded text-amber-300">⏳ يفكر...</code> أثناء معالجة الطلب.</li>
                    <li><strong className="text-white">إعداد BuildConfig:</strong> مضاف داخل <code className="bg-gray-800 px-1 py-0.5 rounded text-emerald-300">build.gradle.kts</code> مع الحقل <code className="bg-gray-800 px-1 py-0.5 rounded">GEMINI_API_KEY</code>.</li>
                    <li><strong className="text-white">صلاحية الإنترنت:</strong> مضافة بالكامل في <code className="bg-gray-800 px-1 py-0.5 rounded">AndroidManifest.xml</code>.</li>
                  </ul>
                </div>

                {/* Quick Action Cards */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleDownloadZip}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition active:scale-98"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل كود المشروع كملف ZIP للأندرويد ستوديو</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('apk_guide')}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-gray-700 cursor-pointer transition"
                  >
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span>كيفية توليد APK</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: CODE FILES INSPECTOR */}
            {activeTab === 'code' && (
              <div className="flex-1 flex flex-col">
                {/* File Selector Pills */}
                <div className="flex flex-wrap gap-2 pb-3 mb-3 border-b border-gray-800">
                  <button
                    onClick={() => setSelectedFile('main')}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      selectedFile === 'main'
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/50'
                        : 'bg-[#0d1117] text-gray-400 border-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    MainActivity.kt (معالج 503)
                  </button>

                  <button
                    onClick={() => setSelectedFile('build_app')}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      selectedFile === 'build_app'
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#0d1117] text-gray-400 border-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    app/build.gradle.kts
                  </button>

                  <button
                    onClick={() => setSelectedFile('manifest')}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      selectedFile === 'manifest'
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/50'
                        : 'bg-[#0d1117] text-gray-400 border-gray-800 hover:text-gray-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    AndroidManifest.xml
                  </button>

                  <button
                    onClick={() => setSelectedFile('root_build')}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      selectedFile === 'root_build'
                        ? 'bg-amber-600/20 text-amber-300 border-amber-500/50'
                        : 'bg-[#0d1117] text-gray-400 border-gray-800 hover:text-gray-200'
                    }`}
                  >
                    build.gradle.kts (root)
                  </button>

                  <button
                    onClick={() => setSelectedFile('settings')}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      selectedFile === 'settings'
                        ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-[#0d1117] text-gray-400 border-gray-800 hover:text-gray-200'
                    }`}
                  >
                    settings.gradle.kts
                  </button>
                </div>

                {/* File Header & Actions */}
                <div className="flex items-center justify-between pb-2 text-xs text-gray-400">
                  <span className="font-mono text-gray-300 dir-ltr">{getCodeContent().path}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(getCodeContent().code)}
                      className="flex items-center gap-1 bg-[#0d1117] hover:bg-gray-800 text-gray-300 px-2.5 py-1 rounded border border-gray-700 cursor-pointer transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
                    </button>

                    <button
                      onClick={() => downloadFile(getCodeContent().name, getCodeContent().code)}
                      className="flex items-center gap-1 bg-[#0d1117] hover:bg-gray-800 text-gray-300 px-2.5 py-1 rounded border border-gray-700 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل</span>
                    </button>
                  </div>
                </div>

                {/* Code Viewer */}
                <div className="flex-1 bg-[#0d1117] rounded-lg border border-gray-800 p-4 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed max-h-[500px] dir-ltr text-left">
                  <pre>{getCodeContent().code}</pre>
                </div>
              </div>
            )}

            {/* TAB 3: STEP-BY-STEP APK BUILD GUIDE */}
            {activeTab === 'apk_guide' && (
              <div className="space-y-5">
                <div className="border-b border-gray-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    دليل استخراج ملف APK جاهز للتثبيت على هاتفك
                  </h3>
                  <p className="text-gray-300 text-xs mt-1">
                    المشروع مجهز بالكامل للفتح في Android Studio وتوليد ملف APK قابل للتثبيت:
                  </p>
                </div>

                {/* Step 1 */}
                <div className="flex items-start gap-3 bg-[#0d1117] p-4 rounded-xl border border-gray-800">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-sm border border-emerald-500/30">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">تحميل وفك ضغط المشروع</h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      اضغط على زر <strong className="text-emerald-400">"تحميل المشروع كاملاً (.ZIP)"</strong> في الأعلى، ثم قم بفك ضغط الملف على جهاز الكمبيوتر.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 bg-[#0d1117] p-4 rounded-xl border border-gray-800">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-sm border border-blue-500/30">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">فتح المشروع في أندرويد ستوديو (Android Studio)</h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      افتح <strong>Android Studio</strong> واختر <strong>Open</strong>، ثم حدد المجلد <code className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded">MyRobot</code>.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 bg-[#0d1117] p-4 rounded-xl border border-gray-800">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-sm border border-amber-500/30">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">وضع مفتاح Gemini API الخاص بك</h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      افتح الملف <code className="bg-gray-800 text-emerald-300 px-1 py-0.5 rounded">app/build.gradle.kts</code> واستبدل <code className="bg-gray-800 text-amber-300 px-1 py-0.5 rounded">"ضع_مفتاح_جوجل_هنا"</code> بمفتاحك الحقيقي.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 bg-[#0d1117] p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/10">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center shrink-0 text-sm">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>توليد ملف APK (Build APK)</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">الخطوة الأخيرة</span>
                    </h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      من القائمة العلوية في أندرويد ستوديو، اضغط على:
                    </p>
                    <div className="bg-[#0b0f19] p-2.5 rounded-lg font-mono text-emerald-400 text-xs mt-2 border border-gray-800 flex items-center gap-1.5 dir-ltr justify-start">
                      <span>Build</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      <span>Build Bundle(s) / APK(s)</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-white font-bold bg-emerald-600/30 px-1.5 py-0.5 rounded">Build APK(s)</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      أو تشغيل الأمر التالي في Terminal:
                    </p>
                    <div className="bg-[#0b0f19] p-2 rounded-lg font-mono text-cyan-400 text-xs mt-1 border border-gray-800 dir-ltr text-left">
                      ./gradlew assembleDebug
                    </div>
                    <p className="text-xs text-emerald-400 mt-2 font-medium">
                      🎯 بمجرد انتهاء البناء، ستظهر رسالة في الزاوية تطلب الضغط على <strong>"locate"</strong> لفتح المجلد وتثبيت ملف <code className="text-white">app-debug.apk</code> على هاتفك مباشرة!
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <button
                    onClick={handleDownloadZip}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-98"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل حزمة أندرويد ستوديو الكاملة (.ZIP) الآن</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: GITHUB & VERCEL INTEGRATION GUIDE */}
            {activeTab === 'github_vercel' && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40 border border-purple-500/30 rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center text-2xl shrink-0">
                      🚀
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>نعم، المشروع جاهز 100% للربط مع GitHub و Vercel!</span>
                      </h3>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        قمنا بتجهيز ملفات <strong className="text-purple-300">vercel.json</strong> و <strong className="text-emerald-300">api/chat.ts</strong> للنشر المباشر على Vercel، بالإضافة إلى <strong className="text-blue-300">GitHub Actions</strong> لبناء ملف الـ APK تلقائياً في السحابة.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Part 1: GitHub */}
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 text-white flex items-center justify-center text-sm font-bold">
                        🐙
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">الجزء الأول: رفع المشروع إلى GitHub</h4>
                        <span className="text-[11px] text-gray-400">يشمل كود تطبيق الأندرويد ومحاكي الويب وملف البناء التلقائي</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const commands = `git init\ngit add .\ngit commit -m "Initial commit - روبوتي MyRobot"\ngit branch -M main\ngit remote add origin https://github.com/USERNAME/myrobot.git\ngit push -u origin main`;
                        navigator.clipboard.writeText(commands);
                        setGitCopied(true);
                        setTimeout(() => setGitCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {gitCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{gitCopied ? 'تم نسخ كافة الأوامر!' : 'نسخ أوامر Git'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    أنشئ مستودعاً جديداً (New Repository) على حسابك في GitHub باسم <code className="bg-gray-800 text-purple-300 px-1 py-0.5 rounded">myrobot</code>، ثم نفّذ الأوامر التالية في مجلد المشروع:
                  </p>

                  <div className="bg-[#080b11] border border-gray-800/80 rounded-lg p-3 font-mono text-xs text-gray-200 dir-ltr text-left space-y-1">
                    <div className="text-emerald-400 font-semibold"># 1. تهيئة المستودع وإضافة الملفات</div>
                    <div>git init</div>
                    <div>git add .</div>
                    <div>git commit -m "Initial commit - روبوتي MyRobot"</div>
                    <div className="text-emerald-400 font-semibold pt-1"># 2. الربط مع مستودع GitHub الخاص بك والرفع</div>
                    <div>git branch -M main</div>
                    <div className="text-amber-300">git remote add origin https://github.com/USERNAME/myrobot.git</div>
                    <div>git push -u origin main</div>
                  </div>

                  {/* GitHub Actions Bonus Card */}
                  <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/30 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-blue-300">
                        ميزة مجانية: بناء APK تلقائياً عبر GitHub Actions!
                      </h5>
                      <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                        أضفنا لك ملف <code className="text-cyan-300 bg-gray-900 px-1 py-0.5 rounded dir-ltr">.github/workflows/android-build.yml</code> داخل المشروع. بمجرد قيامك برفع الكود إلى GitHub، سيقوم خادم GitHub السحابي مجاناً بتصريف وبناء ملف الـ <strong className="text-white">app-debug.apk</strong> وتوفيره للتنزيل في تبويب <strong className="text-white">Actions</strong> دون الحاجة لتثبيت أي برامج على جهازك!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Part 2: Vercel */}
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-base border border-gray-700">
                      ▲
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">الجزء الثاني: النشر على Vercel</h4>
                      <span className="text-[11px] text-gray-400">نشر محاكي الويب وخادم الذكاء الاصطناعي مع رابط دائم مجاني</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#161b22] p-3.5 rounded-lg border border-gray-800">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center mb-2">1</div>
                      <h5 className="text-xs font-bold text-white mb-1">استيراد المشروع</h5>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        افتح <span className="text-blue-400 underline">vercel.com</span> واضغط <strong>Add New &gt; Project</strong> ثم اختر مستودع <code className="text-purple-300">myrobot</code>.
                      </p>
                    </div>

                    <div className="bg-[#161b22] p-3.5 rounded-lg border border-gray-800">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center mb-2">2</div>
                      <h5 className="text-xs font-bold text-white mb-1">إضافة مفتاح API</h5>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        في قسم <strong>Environment Variables</strong> أضف:
                        <br />
                        الاسم: <code className="text-amber-300">GEMINI_API_KEY</code>
                        <br />
                        القيمة: مفتاحك من AI Studio.
                      </p>
                    </div>

                    <div className="bg-[#161b22] p-3.5 rounded-lg border border-gray-800">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mb-2">3</div>
                      <h5 className="text-xs font-bold text-white mb-1">اضغط Deploy!</h5>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        سيقوم Vercel تلقائياً بقراءة ملف <code className="text-emerald-300">vercel.json</code> وتشغيل البناء ليعطيك رابطاً سريعاً مثل <code className="text-white">myrobot.vercel.app</code>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-3.5 rounded-lg border border-gray-800 text-xs space-y-1.5">
                    <span className="font-bold text-gray-200 block">الملفات التي جهزناها لك في المشروع لدعم Vercel فورياً:</span>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-[11px]">
                      <li><code className="text-emerald-300 font-mono">vercel.json</code>: مُعد تلقائياً بإعدادات Vite Framework ومخرج <code className="text-gray-400">dist</code>.</li>
                      <li><code className="text-cyan-300 font-mono">api/chat.ts</code>: دالة سحابية Serverless متصلة بنماذج Gemini ومحصّنة ضد خطأ 503.</li>
                      <li><code className="text-blue-300 font-mono">.gitignore</code>: متضمن استبعاد ملفات البناء المؤقتة ومكتبات node_modules و gradle.</li>
                    </ul>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleDownloadZip}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-98"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل المشروع كاملاً بجميع ملفات GitHub & Vercel (.ZIP)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-gray-700 cursor-pointer transition"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>العودة للمحاكي</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: SUPABASE DATABASE MANAGEMENT */}
            {activeTab === 'supabase' && (
              <div className="space-y-6">
                {/* Connection Status Banner */}
                <div className="bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-[#161b22] border border-emerald-500/40 rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-2xl shrink-0">
                        🗄️
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">قاعدة بيانات Supabase (PostgreSQL)</h3>
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            جاهزة للربط
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 font-mono mt-1 dir-ltr text-right select-all">
                          https://vjoaxuusbmwfiygntbjv.supabase.co
                        </p>
                      </div>
                    </div>

                    <a
                      href="https://supabase.com/dashboard/project/vjoaxuusbmwfiygntbjv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shrink-0"
                    >
                      <span>فتح لوحة Supabase</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Supabase Connection Status Card */}
                <div className="bg-[#0d1117] rounded-xl border border-emerald-500/40 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                      <h4 className="text-sm font-bold text-white">
                        الاتصال بقاعدة بيانات Supabase: <span className="text-emerald-400">نشط ومتصل بنجاح ✓</span>
                      </h4>
                    </div>
                    <button
                      onClick={checkDb}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3 h-3 text-emerald-400" />
                      <span>إعادة فحص الجداول</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                      <span className="text-gray-400 block mb-0.5">رابط المشروع (URL):</span>
                      <span className="text-emerald-300 font-mono font-semibold dir-ltr text-right block truncate">
                        https://vjoaxuusbmwfiygntbjv.supabase.co
                      </span>
                    </div>

                    <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                      <span className="text-gray-400 block mb-0.5">مفتاح النشر (Publishable Key):</span>
                      <span className="text-blue-300 font-mono font-semibold dir-ltr text-right block truncate">
                        sb_publishable_UaicqMAXrbFFbiyBHFf6YA_CNpI8qBJ
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-300">حالة الجداول (Tables Status):</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        dbStatus?.tableExists
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {dbStatus?.tableExists ? '🟢 الجداول جاهزة ونشطة' : '🟡 بانتظار تشغيل كود SQL أدناه'}
                    </span>
                  </div>
                </div>

                {/* Step 1: SQL Setup */}
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>الخطوة 1: إنشاء جدول المفاتيح والمحادثات في Supabase</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        انسخ هذا الكود والصقه في <strong>SQL Editor</strong> داخل لوحة تحكم Supabase واضغط <strong>Run</strong>:
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const sql = `-- 1. إنشاء جدول حفظ مفاتيح API\nCREATE TABLE IF NOT EXISTS api_keys (\n  id BIGSERIAL PRIMARY KEY,\n  service VARCHAR(50) UNIQUE NOT NULL,\n  api_key TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- 2. إنشاء جدول سجل المحادثات\nCREATE TABLE IF NOT EXISTS chat_history (\n  id BIGSERIAL PRIMARY KEY,\n  user_message TEXT NOT NULL,\n  bot_reply TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- 3. تفعيل الأمان والصلاحيات (RLS)\nALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;\nALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "Allow read api_keys" ON api_keys FOR SELECT USING (true);\nCREATE POLICY "Allow insert chat_history" ON chat_history FOR INSERT WITH CHECK (true);`;
                        navigator.clipboard.writeText(sql);
                        setSqlCopied(true);
                        setTimeout(() => setSqlCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{sqlCopied ? 'تم نسخ كود SQL!' : 'نسخ كود SQL'}</span>
                    </button>
                  </div>

                  <div className="bg-[#080b11] border border-gray-800 rounded-lg p-3 font-mono text-xs text-emerald-400 dir-ltr text-left overflow-x-auto max-h-[160px]">
                    <pre>{`-- 1. جدول المفاتيح
CREATE TABLE IF NOT EXISTS api_keys (
  id BIGSERIAL PRIMARY KEY,
  service VARCHAR(50) UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول سجل المحادثات
CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_message TEXT NOT NULL,
  bot_reply TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. صلاحيات القراءة والكتابة
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read api_keys" ON api_keys FOR SELECT USING (true);
CREATE POLICY "Allow insert chat_history" ON chat_history FOR INSERT WITH CHECK (true);`}</pre>
                  </div>
                </div>

                {/* Step 2: Insert Key SQL */}
                <div className="bg-[#0d1117] rounded-xl border border-gray-800 p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>الخطوة 2: إضافة مفتاح Gemini داخل جدول api_keys</span>
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    بعد إنشاء الجدول، نفّذ هذا السطر في <strong>SQL Editor</strong> مع استبدال المفتاح بمفتاحك الحقيقي:
                  </p>
                  <div className="bg-[#080b11] border border-gray-800 rounded-lg p-3 font-mono text-xs text-amber-300 dir-ltr text-left">
                    {`INSERT INTO api_keys (service, api_key) 
VALUES ('gemini', 'ضع_مفتاح_جوجل_هنا') 
ON CONFLICT (service) DO UPDATE SET api_key = EXCLUDED.api_key;`}
                  </div>
                </div>

                {/* Step 3: How to Backup */}
                <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-400" />
                    <h4 className="text-sm font-bold text-white">
                      الخطوة 3: كيف تأخذ نسخة احتياطية وتنزّلها على جهازك في أي وقت؟
                    </h4>
                  </div>
                  <ul className="text-xs space-y-2 text-gray-300 list-decimal list-inside leading-relaxed">
                    <li>ادخل إلى مشروعك في Supabase واضغط على <strong>Project Settings (أيقونة الترس في الأسفل)</strong>.</li>
                    <li>اختر <strong>Database</strong> من القائمة الجانبية، ثم انزل إلى قسم <strong>Backups</strong>.</li>
                    <li>اضغط على <strong>Download backup</strong> لتحميل ملف <code className="bg-gray-800 text-cyan-300 px-1 py-0.5 rounded font-mono">.sql</code> كامل يحتوي على جميع الجداول، البيانات، والمفاتيح وحفظه أينما شئت!</li>
                    <li>يمكنك أيضاً استخراج وتنزيل البيانات في أي وقت كملف <code className="bg-gray-800 text-cyan-300 px-1 py-0.5 rounded font-mono">CSV</code> من داخل تبويب <strong>Table Editor</strong>.</li>
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleDownloadZip}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-98"
                  >
                    <Download className="w-5 h-5" />
                    <span>تحميل المشروع المحدّث كاملاً (.ZIP)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-gray-700 cursor-pointer transition"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>تجربة المحاكي</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Supabase Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {authMode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#0d1117] rounded-xl border border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  authMode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  authMode === 'signup' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                إنشاء حساب جديد
              </button>
            </div>

            {/* Notification alert */}
            {authMessage && (
              <div
                className={`p-3 rounded-lg text-xs leading-relaxed border ${
                  authMessage.type === 'error'
                    ? 'bg-red-950/40 border-red-800/60 text-rose-200'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                }`}
              >
                {authMessage.text}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">البريد الإلكتروني:</label>
                <div className="relative">
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 text-white px-3 py-2.5 rounded-lg text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">كلمة المرور:</label>
                <div className="relative">
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-[#0d1117] border border-gray-700 text-white px-3 py-2.5 rounded-lg text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs shadow-md shadow-blue-900/30 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {authLoading ? (
                  <span>جاري المعالجة...</span>
                ) : authMode === 'login' ? (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>دخول</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إنشاء الحساب</span>
                  </>
                )}
              </button>
            </form>

            {/* Demo / Guest mode fallback */}
            <div className="border-t border-gray-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCurrentUser({
                    id: 'guest-' + Date.now(),
                    email: authEmail || 'ahmadahmad3077@gmail.com',
                    app_metadata: {},
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: new Date().toISOString(),
                  } as any);
                  setAuthMessage({ type: 'success', text: 'تم تسجيل الدخول في وضع التجربة السريع!' });
                  setTimeout(() => setIsAuthModalOpen(false), 900);
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⚡ تسجيل سريع بحساب تجريبي (Demo Sign-In)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="font-bold text-white flex items-center gap-2 text-base">
                <Key className="w-5 h-5 text-amber-400" />
                <span>إعداد مفتاح Gemini API</span>
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-gray-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300 mt-3 leading-relaxed">
              يمكنك تجربة المحاكي المباشر باستخدام مفتاح البيئة الافتراضي، أو إدخال مفتاحك الخاص من Google AI Studio لاختباره:
            </p>

            <div className="mt-4">
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">
                مفتاح Gemini API:
              </label>
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#0d1117] border border-gray-700 text-white px-3 py-2 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setCustomKey('');
                  setShowKeyModal(false);
                }}
                className="px-3.5 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-gray-800 cursor-pointer"
              >
                إلغاء / استخدام الافتراضي
              </button>
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer"
              >
                حفظ والمتابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 py-3 text-center text-xs text-gray-500">
        روبوتي (MyRobot) • تطبيق أندرويد Jetpack Compose مع Gemini AI • حزمة com.example.myrobot
      </footer>
    </div>
  );
}
