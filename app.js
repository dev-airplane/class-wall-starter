import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// 지금은 데이터가 아래 배열에만 들어 있어서,
// 브라우저를 새로고침하면 전부 사라집니다.
// ===================================================


// Firebase 프로젝트에 연결합니다.
const firebaseConfig = {
  apiKey: "AIzaSyDCPUulvNlkiyeAUsxc0qRe7T_ZgEU00u8",
  authDomain: "class-wall-starter-4080d.firebaseapp.com",
  projectId: "class-wall-starter-4080d",
  storageBucket: "class-wall-starter-4080d.firebasestorage.app",
  messagingSenderId: "633427462070",
  appId: "1:633427462070:web:d482a20e2152ea93fbe317"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memosRef = collection(db, "memos");
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const teacherUid = "EvFFdchN9oa6C4ocjV5QX36IAFw1";

// 현재 로그인한 사용자가 교사인지 확인합니다.
function isTeacher(user) {
  return user && user.uid === teacherUid;
}


// ===================================================
// 데이터를 다루는 함수 세 개
// 백엔드 1 시간에 이 세 개가 Firestore를 쓰는 코드로 바뀝니다.
// ===================================================

// 메모를 읽어 옵니다.
// 백엔드 1: 여기가 Firestore에서 가져오는 코드로 바뀝니다.
//           순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
  const memoQuery = query(memosRef, orderBy("createdAt"));
  const snapshot = await getDocs(memoQuery);

  return Promise.all(snapshot.docs.map(async function (memo) {
    const aiCommentRef = doc(db, "memos", memo.id, "aiComments", "latest");
    const aiComment = await getDoc(aiCommentRef);

    return {
      id: memo.id,
      text: memo.data().text,
      createdAt: memo.data().createdAt,
      uid: memo.data().uid,
      aiComment: aiComment.exists() ? aiComment.data().text : ""
    };
  }));
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(memosRef, {
    text: text,
    createdAt: Date.now(),
    uid: auth.currentUser.uid
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}

// 교사가 Gemini에게 메모 본문만 보내고, 받은 코멘트를 저장합니다.
async function addAiComment(memo) {
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + idToken
    },
    body: JSON.stringify({ text: memo.text })
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "AI 코멘트를 만들지 못했습니다.");
  }

  await setDoc(doc(db, "memos", memo.id, "aiComments", "latest"), {
    text: result.comment,
    createdAt: Date.now()
  });
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const user = auth.currentUser;
  if (!user) return;

  const memos = await loadMemos();
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 로그인 상태에 맞춰 사용자 영역을 그립니다.
function renderUser(user) {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  const button = document.createElement("button");

  if (user) {
    const message = document.createElement("span");
    message.textContent = (isTeacher(user) ? "교사" : "학생") + " 로그인됨 ";
    userArea.appendChild(message);

    button.textContent = "로그아웃";
    button.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃하지 못했습니다.", error);
        alert("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  } else {
    button.textContent = "Google로 로그인";
    button.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("로그인하지 못했습니다.", error);
        alert("로그인하지 못했습니다. Firebase Authentication 설정을 확인해 주세요.");
      }
    });
  }

  userArea.appendChild(button);
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 교사와 메모 작성자에게만 지우기 버튼을 보여 줍니다.
  if (isTeacher(auth.currentUser) || (auth.currentUser && memo.uid === auth.currentUser.uid)) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      try {
        await deleteMemo(memo.id);
        await render();
      } catch (error) {
        console.error("메모를 지우지 못했습니다.", error);
        alert("메모를 지우지 못했습니다. Firestore 설정을 확인해 주세요.");
      }
    });
    div.appendChild(del);
  }

  // 교사만 AI 코멘트를 만들 수 있습니다.
  if (isTeacher(auth.currentUser)) {
    const ai = document.createElement("button");
    ai.textContent = "AI 코멘트";
    ai.addEventListener("click", async function () {
      ai.disabled = true;
      ai.textContent = "생성 중";

      try {
        await addAiComment(memo);
        await render();
      } catch (error) {
        console.error("AI 코멘트를 만들지 못했습니다.", error);
        alert("AI 코멘트를 만들지 못했습니다: " + error.message);
      } finally {
        ai.disabled = false;
        ai.textContent = "AI 코멘트";
      }
    });
    div.appendChild(ai);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  if (memo.aiComment) {
    const comment = document.createElement("p");
    comment.className = "ai-comment";
    comment.textContent = "AI 코멘트: " + memo.aiComment;
    div.appendChild(comment);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;
    if (!auth.currentUser) {
      alert("메모를 쓰려면 먼저 로그인해 주세요.");
      return;
    }

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (error) {
      console.error("메모를 저장하지 못했습니다.", error);
      alert("메모를 저장하지 못했습니다. Firestore 설정을 확인해 주세요.");
    }
  }
});


// 로그인하거나 로그아웃할 때 화면을 맞춥니다.
onAuthStateChanged(auth, function (user) {
  renderUser(user);

  if (!user) {
    document.getElementById("wall").innerHTML = "";
    return;
  }

  render().catch(function (error) {
    console.error("메모를 불러오지 못했습니다.", error);
    alert("메모를 불러오지 못했습니다. Firestore 설정을 확인해 주세요.");
  });
});
input.focus();
