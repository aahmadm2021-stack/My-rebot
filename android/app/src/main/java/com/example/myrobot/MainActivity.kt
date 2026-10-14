package com.example.myrobot

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
        "⚠️ خطأ: ${e.message}"
    }
}
