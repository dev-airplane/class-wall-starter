import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

  return snapshot.docs.map(function (memo) {
    return {
      id: memo.id,
      text: memo.data().text,
      createdAt: memo.data().createdAt
    };
  });
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(memosRef, {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

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

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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


// 첫 화면 그리기
render().catch(function (error) {
  console.error("메모를 불러오지 못했습니다.", error);
  alert("메모를 불러오지 못했습니다. Firestore 설정을 확인해 주세요.");
});
input.focus();
