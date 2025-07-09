# Joinilo - Excel Sheet Merge & Search Tool

**Joinilo**는 여러 개의 엑셀 파일 시트(.xlsx)를 쉽고 빠르게 병합하고, 실시간 검색/그룹핑/추출까지 지원하는 웹앱입니다.

- **Frontend:** React + Vite  
- **배포:** GitHub Pages  
- **기능:**  
  - 엑셀 파일 업로드(복수)
  - 시트별 병합(append/join/수동키 병합)
  - 다중 컬럼/조건 실시간 검색
  - 그룹바이/함수 집계
  - 결과 테이블 내 컬럼 드래그, 셀 수정, 삭제
  - 다국어 지원

## 사용법

1. 웹앱 접속: [https://befive9.github.io/joinilo/](https://befive9.github.io/joinilo/)
2. 엑셀 파일 드래그 또는 클릭 업로드
3. 원하는 시트/병합 방식 선택
4. 실시간 검색/그룹 기능 활용
5. 결과 엑셀 다운로드 or 복사

## 개발

```bash
git clone https://github.com/befive9/joinilo.git
cd joinilo
npm install
npm run dev

cd joinilo
npm install
npm run dev    # 개발용
npm run build  # 빌드 (dist 폴더 생성)
