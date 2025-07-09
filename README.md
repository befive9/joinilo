# Joinilo - Excel Sheet Merger

엑셀 파일의 여러 시트를 **웹에서 쉽게 병합, 추출, 검색**할 수 있는 무료 오픈소스 툴입니다.

[👉 바로가기: https://befive9.github.io/joinilo/](https://befive9.github.io/joinilo/)

---

## 🛠️ 기술 스택

- **React** + **Vite**
- xlsx.js, react-multi-select-component, i18next, TailwindCSS 등

---

## 주요 기능

- 여러 엑셀 파일/시트 **동시 업로드 및 선택**
- **Append**/ **자동 병합(JOIN)**/ **수동 키 병합**  
- 컬럼/행 다중 선택, 정렬, 이동, 삭제
- **검색, 다중조건 필터, 그룹 함수 지원**
- 셀 편집, 실시간 결과 반영
- **다국어 지원** (한국어, 영어, 중국어, 프랑스어, 러시아어, 힌디어)
- 결과 **엑셀로 추출**

---

## 사용법

1. 엑셀(.xlsx) 파일을 업로드합니다.
2. 원하는 시트를 선택해 병합 방식을 고릅니다.
3. 결과 테이블에서 검색, 그룹, 편집 등 필요한 작업을 한 뒤  
   복사/다운로드/추출 버튼을 활용하세요.

---

## 🚩 Footer(푸터) 표시 안내

> **사이트 하단(Privacy Policy & Contact)이 보이지 않는 경우**
>
> - 브라우저 캐시 삭제 후 새로고침(Ctrl+F5)  
> - 화면을 스크롤 하단까지 내려 확인  
> - 혹시 화면이 잘려 보인다면,  
>   브라우저 창 크기를 늘리거나 확대/축소를 조절  
> - CSS 수정 시, 푸터가 `<div>...</div>` 바깥이나 `display: none`/`overflow: hidden` 등의  
>   스타일로 인해 보이지 않는지 꼭 체크하세요.
>
> 실제 코드 예시:
> ```jsx
> <footer style={{
>   width: "100vw",
>   textAlign: "center",
>   fontSize: 14,
>   color: "#888",
>   padding: "1.5rem 0 1rem 0",
>   background: "transparent",
>   marginTop: 32
> }}>
>   <a
>     href="https://docs.google.com/document/d/e/2PACX-1vTtflKl_LyP__VFyNFbmUlHtQ1mZH1VKAszepwd1hhSymA1_dqZ2HekmjhhIu7gNVgwFNQmiOzRbUKn/pub"
>     target="_blank"
>     rel="noopener noreferrer"
>     style={{ color: "#2563eb", textDecoration: "underline" }}
>   >
>     Privacy Policy
>   </a>
>   &nbsp;|&nbsp; Contact: <a href="mailto:befive99@naver.com">befive99@naver.com</a>
> </footer>
> ```
>
> - 푸터는 반드시 **최상위 JSX 밖**이 아니라,  
>   전체 `<div>`(앱 컨테이너)와 같은 최상위 `<></>` Fragment 안에 위치해야 합니다.
> - App 컴포넌트의 return 부분 예시:
>   ```jsx
>   return (
>     <>
>       <div> ... </div>
>       <footer> ... </footer>
>     </>
>   )
>   ```

---

## 📜 [Privacy Policy](https://docs.google.com/document/d/e/2PACX-1vTtflKl_LyP__VFyNFbmUlHtQ1mZH1VKAszepwd1hhSymA1_dqZ2HekmjhhIu7gNVgwFNQmiOzRbUKn/pub)
- 문의: befive99@naver.com

---

## 로컬 실행 방법

```sh
git clone https://github.com/befive9/joinilo.git
cd joinilo
npm install
npm run dev    # 개발용
npm run build  # 빌드 (dist 폴더 생성)
