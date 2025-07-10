import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { MultiSelect } from "react-multi-select-component";
import IntroHeader from "./components/IntroHeader";

// ===== i18n 설정 =====
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import resources from "./i18n";

// 브라우저 언어 자동감지
let detectedLang = navigator.language?.slice(0, 2) || "en";
if (!["ko", "en", "zh", "fr", "ru", "hi"].includes(detectedLang)) detectedLang = "en";
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectedLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

// ===== 병합 함수들 =====
function appendMerge(targets) {
  const headerRow = [];
  targets.forEach((target) => {
    const headers = target.data[0];
    headers.forEach((h) => {
      if (!headerRow.includes(h)) headerRow.push(h);
    });
  });
  const merged = [headerRow];
  targets.forEach((target) => {
    const [headers, ...rows] = target.data;
    rows.forEach((row) => {
      const rowObj = {};
      headers.forEach((h, i) => { rowObj[h] = row[i]; });
      const finalRow = headerRow.map((h) => rowObj[h] || "");
      merged.push(finalRow);
    });
  });
  return merged;
}
function joinMerge(targets, keys) {
  const maps = targets.map((target) => {
    const [headers, ...rows] = target.data;
    const map = new Map();
    rows.forEach((row) => {
      const keyStr = keys.map((k) => row[headers.indexOf(k)]).join("___");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      map.set(keyStr, obj);
    });
    return { headers, map };
  });
  const allKeys = Array.from(
    new Set(maps.flatMap(({ map }) => Array.from(map.keys())))
  );
  const headers = Array.from(new Set(maps.flatMap(({ headers }) => headers)));
  const merged = [headers];
  allKeys.forEach((k) => {
    const rowObj = {};
    maps.forEach(({ map }) => {
      const entry = map.get(k);
      if (entry) Object.assign(rowObj, entry);
    });
    const row = headers.map((h) => rowObj[h] || "");
    merged.push(row);
  });
  return merged;
}
function autoJoinWithAppend(targets) {
  const keyCandidates = targets.map((t) => t.data[0]);
  const keyCount = {};
  keyCandidates.flat().forEach(k => { keyCount[k] = (keyCount[k] || 0) + 1; });
  const commonKeys = Object.entries(keyCount).filter(([k, v]) => v > 1).map(([k]) => k);
  if (commonKeys.length === 0) return appendMerge(targets);
  const joinGroup = targets.filter(t => commonKeys.every(k => t.data[0].includes(k)));
  const appendGroup = targets.filter(t => !commonKeys.every(k => t.data[0].includes(k)));
  let merged = [];
  if (joinGroup.length > 1) {
    merged = joinMerge(joinGroup, [commonKeys[0]]);
  } else if (joinGroup.length === 1) {
    appendGroup.push(joinGroup[0]);
    merged = [];
  }
  if (appendGroup.length) {
    const appendData = appendMerge(appendGroup);
    if (merged.length === 0) {
      merged = appendData;
    } else {
      const allCols = Array.from(new Set([...merged[0], ...appendData[0]]));
      const rebase = arr => arr.map(row => allCols.map(h => {
        const idx = arr[0].indexOf(h);
        return idx !== -1 ? row[idx] : "";
      }));
      merged = rebase(merged).concat(rebase(appendData).slice(1));
    }
  }
  return merged;
}
function groupByTable(table, groupKeys, aggCols, aggType = "count") {
  if (!Array.isArray(groupKeys)) groupKeys = [groupKeys];
  if (!Array.isArray(aggCols)) aggCols = [aggCols];
  const headerIdx = table[0].reduce((acc, col, i) => ({ ...acc, [col]: i }), {});
  const groupIdxArr = groupKeys.map(k => headerIdx[k]);
  const valueIdxArr = aggCols.map(c => headerIdx[c]);
  const groupMap = new Map();

  for (let i = 1; i < table.length; ++i) {
    const row = table[i];
    const groupValue = groupIdxArr.map(idx => row[idx]).join("␟");
    if (!groupMap.has(groupValue)) {
      groupMap.set(groupValue, {
        keys: groupIdxArr.map(idx => row[idx]),
        count: 0,
        sum: valueIdxArr.map(() => 0),
        min: valueIdxArr.map(() => Infinity),
        max: valueIdxArr.map(() => -Infinity),
      });
    }
    const entry = groupMap.get(groupValue);
    entry.count += 1;
    valueIdxArr.forEach((idx, k) => {
      const v = idx !== undefined ? parseFloat(row[idx]) : NaN;
      if (!isNaN(v)) {
        entry.sum[k] += v;
        if (v < entry.min[k]) entry.min[k] = v;
        if (v > entry.max[k]) entry.max[k] = v;
      }
    });
  }
  let headers = [...groupKeys];
  if (aggType === "count") headers.push("COUNT");
  else headers.push(...aggCols.map(col => `${aggType.toUpperCase()}(${col})`));
  const result = [headers];
  groupMap.forEach((entry) => {
    if (aggType === "count") result.push([...entry.keys, entry.count]);
    else if (aggType === "sum") result.push([...entry.keys, ...entry.sum.map(n => isFinite(n) ? n : "")]);
    else if (aggType === "avg") result.push([...entry.keys, ...entry.sum.map((s, i) => (entry.count ? (s / entry.count).toFixed(2) : ""))]);
    else if (aggType === "min") result.push([...entry.keys, ...entry.min.map(n => isFinite(n) ? n : "")]);
    else if (aggType === "max") result.push([...entry.keys, ...entry.max.map(n => isFinite(n) ? n : "")]);
  });
  return result;
}
function exportToExcel(table, fileName = "result.xlsx") {
  const ws = XLSX.utils.aoa_to_sheet(table);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, fileName);
}

function App() {
  const { t, i18n } = useTranslation();
  const resizingCol = useRef(null);
  const dragColIdx = useRef(null);

  const [step, setStep] = useState(1);
  const [tables, setTables] = useState([]);
  const [sheetList, setSheetList] = useState([]);
  const [checkedSheets, setCheckedSheets] = useState([]);
  const [mergeMode, setMergeMode] = useState("append");
  const [manualKeys, setManualKeys] = useState([""]);
  const [mergedTable, setMergedTable] = useState([]);
  const [filters, setFilters] = useState([]);
  const [groupKeys, setGroupKeys] = useState([]);
  const [aggCols, setAggCols] = useState([]);
  const [aggType, setAggType] = useState("count");
  const [groupTable, setGroupTable] = useState(null);
  const [colOrder, setColOrder] = useState([]);
  const [sortState, setSortState] = useState({ col: null, desc: false });
  const [selectedCols, setSelectedCols] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editCell, setEditCell] = useState({ row: null, col: null });
  const [editValue, setEditValue] = useState("");
  const [lastCheckedRow, setLastCheckedRow] = useState(null);
  const [lastCheckedCol, setLastCheckedCol] = useState(null);
  const [colWidths, setColWidths] = useState([]);

  // 파일 업로드
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    let allSheets = [];
    for (const file of selectedFiles) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheets = workbook.SheetNames.map((sheetName) => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        return {
          fileName: file.name,
          sheetName,
          data: rows,
        };
      });
      allSheets = allSheets.concat(sheets);
    }
    setTables(allSheets);
    setSheetList(allSheets);
    setCheckedSheets(allSheets.map(() => true));
    setStep(1);
    setMergeMode("append");
    setManualKeys([""]);
    setMergedTable([]);
    setGroupKeys([]);
    setAggCols([]);
    setGroupTable(null);
    setColOrder([]);
    setSortState({ col: null, desc: false });
    setSelectedCols([]);
    setSelectedRows([]);
    setLastCheckedRow(null);
    setColWidths([]);
    setLastCheckedCol(null);
  };

  // 시트 체크/모두선택
  const toggleSheet = (idx) => {
    setCheckedSheets((prev) => {
      const arr = [...prev];
      arr[idx] = !arr[idx];
      return arr;
    });
  };
  const setAllSheets = (value) => setCheckedSheets(sheetList.map(() => value));

  // 병합
  const setMergedWithOrder = (table) => {
    setMergedTable(table);
    setColOrder(table[0].map((_, i) => i));
    setFilters([]);
    setStep(2);
    setGroupKeys([]);
    setAggCols([]);
    setGroupTable(null);
    setSelectedRows([]);
    setSortState({ col: null, desc: false });
    setSelectedCols([]);
    setLastCheckedRow(null);
    setColWidths([]);
    setLastCheckedCol(null);
  };
  function getManualKeyOptions() {
    const targets = sheetList.filter((_, i) => checkedSheets[i]);
    if (targets.length === 0) return [];
    let common = targets[0].data[0];
    for (let i = 1; i < targets.length; ++i) {
      common = common.filter((col) => targets[i].data[0].includes(col));
    }
    return common;
  }
  function canManualMerge(keys) {
    const targets = sheetList.filter((_, i) => checkedSheets[i]);
    if (targets.length < 2) return false;
    return keys.every((k) =>
      targets.every((t) => t.data[0].includes(k))
    );
  }
  const handleMerge = (mode = "append", keys = []) => {
    const targets = sheetList.filter((_, i) => checkedSheets[i]);
    if (targets.length === 0) {
      alert(t("SELECT_SHEET_ALERT") || "최소 한 개 이상 시트를 선택하세요!");
      return;
    }
    let merged = [];
    if (mode === "append") {
      merged = appendMerge(targets);
    } else if (mode === "auto") {
      merged = autoJoinWithAppend(targets);
    } else if (mode === "manual") {
      if (!keys.every((k) => k && k.length > 0)) {
        alert(t("SELECT_KEY_ALERT") || "병합할 컬럼을 모두 선택하세요.");
        return;
      }
      if (!canManualMerge(keys)) {
        alert(t("NEED_KEY_ALL_SHEET_ALERT") || "선택한 모든 시트에 해당 키가 존재해야 합니다.");
        return;
      }
      merged = joinMerge(targets, keys);
      if (merged.length <= 1) {
        alert(t("NO_MERGE_DATA_ALERT") || "선택한 키 기준으로 병합할 수 있는 데이터가 없습니다.");
        return;
      }
    }
    setMergedWithOrder(merged);
  };

  // 정렬/검색/colOrder 적용
  const handleHeaderClick = (e, colIdx) => {
    if (e.target.type === "checkbox") return;
    const colName = (groupTable || mergedTable)[0][colOrder[colIdx]];
    setSortState(prev => {
      if (prev.col === colName && !prev.desc) return { col: colName, desc: true };
      if (prev.col === colName && prev.desc) return { col: null, desc: false };
      return { col: colName, desc: false };
    });
    setSelectedCols([colIdx]);
    setLastCheckedCol(colIdx);
  };

  // 필터 + 정렬 + colOrder
  const filteredTable = (() => {
    let table = groupTable || mergedTable;
    if (!table || table.length === 0) return [];
    let rows = table.filter((row, idx) => {
      if (idx === 0) return true;
      return filters.every((filter) => {
        const colIdx = table[0].findIndex(h => h === filter.column);
        if (colIdx === -1) return true;
        return (row[colIdx] ?? "").toString().toLowerCase().includes(filter.keyword.toLowerCase());
      });
    });
    if (sortState.col && rows.length > 1) {
      const colIdx = rows[0].findIndex(h => h === sortState.col);
      if (colIdx !== -1) {
        const body = rows.slice(1).sort((a, b) => {
          const av = a[colIdx];
          const bv = b[colIdx];
          const aNum = parseFloat(av);
          const bNum = parseFloat(bv);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortState.desc ? bNum - aNum : aNum - bNum;
          } else {
            return sortState.desc
              ? bv.toString().localeCompare(av.toString(), undefined, { numeric: true })
              : av.toString().localeCompare(bv.toString(), undefined, { numeric: true });
          }
        });
        rows = [rows[0], ...body];
      }
    }
    return rows.map(row => colOrder.map(i => row[i]));
  })();

  // 필터
  const addFilter = () => setFilters([...filters, { column: "", keyword: "" }]);
  const updateFilter = (index, field, value) => {
    const updated = [...filters];
    updated[index][field] = value;
    setFilters(updated);
  };
  const removeFilter = (index) => setFilters(filters.filter((_, i) => i !== index));

  // 수동 병합 키
  const addManualKey = () => setManualKeys([...manualKeys, ""]);
  const updateManualKey = (idx, value) => {
    const updated = [...manualKeys];
    updated[idx] = value;
    setManualKeys(updated);
  };
  const removeManualKey = (idx) => setManualKeys(manualKeys.filter((_, i) => i !== idx));

  // 그룹 By
  const handleGroupBy = () => {
    if (!groupKeys.length) {
      alert(t("NEED_GROUP_COL_ALERT") || "Group By 컬럼을 1개 이상 선택하세요.");
      return;
    }
    if (aggType !== "count" && !aggCols.length) {
      alert(t("NEED_AGG_COL_ALERT") || "집계 컬럼을 1개 이상 선택하세요.");
      return;
    }
    setGroupTable(groupByTable(mergedTable, groupKeys, aggCols, aggType));
    setColOrder(Array.from({ length: groupKeys.length + (aggType === "count" ? 1 : aggCols.length) }, (_, i) => i));
    setSortState({ col: null, desc: false });
    setSelectedCols([]);
    setSelectedRows([]);
    setLastCheckedRow(null);
    setLastCheckedCol(null);
    setColWidths([]);
  };

  // 컬럼 체크박스(다중선택, 연속선택)
  const handleColCheckbox = (e, cIdx) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedCols.includes(cIdx)) {
        setSelectedCols(selectedCols.filter(i => i !== cIdx));
      } else {
        setSelectedCols([...selectedCols, cIdx].sort((a, b) => a - b));
      }
      setLastCheckedCol(cIdx);
    } else if (e.shiftKey && lastCheckedCol !== null) {
      const [min, max] = [lastCheckedCol, cIdx].sort((a, b) => a - b);
      const range = [];
      for (let i = min; i <= max; i++) range.push(i);
      setSelectedCols(Array.from(new Set([...selectedCols, ...range])).sort((a, b) => a - b));
    } else {
      setSelectedCols([cIdx]);
      setLastCheckedCol(cIdx);
    }
    e.stopPropagation();
  };

  // 컬럼 삭제
  const deleteSelectedCols = () => {
    setColOrder(colOrder.filter((_, i) => !selectedCols.includes(i)));
    if (groupTable) {
      setGroupTable((table) => table.map((row) => row.filter((_, i) => !selectedCols.includes(i))));
    } else {
      setMergedTable((table) => table.map((row) => row.filter((_, i) => !selectedCols.includes(i))));
    }
    setSelectedCols([]);
  };

  // 컬럼 리사이저 (드래그로 크기조절)
  const startResize = (colIdx, e) => {
    resizingCol.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] || 120 };
    document.addEventListener("mousemove", onResize, false);
    document.addEventListener("mouseup", stopResize, false);
  };
  const onResize = (e) => {
    if (!resizingCol.current) return;
    const { colIdx, startX, startW } = resizingCol.current;
    const delta = e.clientX - startX;
    setColWidths((prev) => {
      const arr = [...prev];
      arr[colIdx] = Math.max(40, (startW || 120) + delta);
      return arr;
    });
  };
  const stopResize = () => {
    resizingCol.current = null;
    document.removeEventListener("mousemove", onResize, false);
    document.removeEventListener("mouseup", stopResize, false);
  };

  // 컬럼 드래그&드롭
  const handleColDragStart = (cIdx) => { dragColIdx.current = cIdx; };
  const handleColDragOver = (e) => { e.preventDefault(); };
  const handleColDrop = (toIdx) => {
    if (dragColIdx.current == null || dragColIdx.current === toIdx) return;
    let movingCols = selectedCols.includes(dragColIdx.current) ? selectedCols.slice() : [dragColIdx.current];
    movingCols.sort((a,b)=>a-b);
    let remainCols = colOrder.filter((_, i) => !movingCols.includes(i));
    let insertAt = toIdx;
    if (insertAt > Math.max(...movingCols)) insertAt -= movingCols.length;
    let newOrder = [
      ...remainCols.slice(0, insertAt),
      ...movingCols.map(idx => colOrder[idx]),
      ...remainCols.slice(insertAt)
    ];
    setColOrder(newOrder);
    dragColIdx.current = null;
  };

  // 행 체크박스
  const toggleRowCheckbox = (idx, e) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedRows.includes(idx)) {
        setSelectedRows(selectedRows.filter(i => i !== idx));
      } else {
        setSelectedRows([...selectedRows, idx].sort((a, b) => a - b));
      }
      setLastCheckedRow(idx);
    } else if (e.shiftKey && lastCheckedRow !== null) {
      const [from, to] = [lastCheckedRow, idx].sort((a, b) => a - b);
      let range = [];
      for (let i = from; i <= to; ++i) range.push(i);
      setSelectedRows(Array.from(new Set([...selectedRows, ...range])).sort((a, b) => a - b));
    } else {
      setSelectedRows([idx]);
      setLastCheckedRow(idx);
    }
  };

  // 행 삭제
  const deleteSelectedRows = () => {
    if (selectedRows.length === 0) return;
    const t = groupTable ? [...groupTable] : [...mergedTable];
    const remain = t.filter((row, idx) => idx === 0 || !selectedRows.includes(idx));
    if (groupTable) setGroupTable(remain);
    else setMergedTable(remain);
    setSelectedRows([]);
    setLastCheckedRow(null);
  };

  // 셀 편집
  const handleCellClick = (rowIdx, colIdx, value) => {
    setEditCell({ row: rowIdx, col: colIdx });
    setEditValue(value);
  };
  const handleCellEdit = (e) => setEditValue(e.target.value);
  const handleCellEditBlur = () => {
    if (editCell.row !== null && editCell.col !== null) {
      const t = groupTable ? [...groupTable] : [...mergedTable];
      t[editCell.row][editCell.col] = editValue;
      if (groupTable) setGroupTable(t);
      else setMergedTable(t);
      setEditCell({ row: null, col: null });
    }
  };

  // 복사 기능 (Copy)
  const handleCopyTable = () => {
    let table = groupTable || mergedTable;
    if (!table.length) return;
    const text = table.map(row =>
      row.map(cell =>
        (cell == null ? "" : cell).toString().replace(/(\t|\n)/g, " ")
      ).join("\t")
    ).join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert(t("COPY_ALERT") || "복사되었습니다!");
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert(t("COPY_ALERT") || "복사되었습니다!");
    }
  };

  // 옵션 변환
  const getMultiOptions = arr =>
    (arr || []).map(col => ({ label: col, value: col }));

  // 언어 드롭다운
  const LangDropdown = (
    <div style={{
      position: "fixed", right: 24, top: 20, zIndex: 100,
      background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee", padding: "4px 16px"
    }}>
      <label htmlFor="lang-select" style={{ marginRight: 6, fontWeight: "bold" }}>
        {t("LANG") || "Language"}
      </label>
      <select
        id="lang-select"
        value={i18n.language}
        onChange={e => i18n.changeLanguage(e.target.value)}
        style={{ borderRadius: 4, padding: "2px 6px" }}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="fr">Français</option>
        <option value="ru">Русский</option>
        <option value="hi">हिंदी</option>
      </select>
    </div>
  );

  // ===== 렌더링 =====
  return (
     <>
    <div style={{ width: "100vw", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "#fafafe" }}>
      {LangDropdown}
      <IntroHeader onFileChange={handleFileChange} />
      <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {step === 1 && (
          <div style={{ padding: "2rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18, justifyContent: "center" }}>
              <button onClick={() => handleMerge("auto")}
                style={{ background: "#6d28d9", color: "white", borderRadius: 10, padding: "0.4rem 1.2rem", fontWeight: "bold", fontSize: 16, minWidth: 120 }}>{t("AUTO_MERGE")}</button>
              <button onClick={() => handleMerge("append")}
                style={{ background: "#a21caf", color: "white", borderRadius: 10, padding: "0.4rem 1.1rem", fontWeight: "bold", fontSize: 16, minWidth: 120 }}>{t("APPEND_MERGE")}</button>
              <div style={{ marginLeft: 14 }}>
                <b>{t("MANUAL_MERGE")}</b>
                {manualKeys.map((k, idx) => (
                  <span key={idx} style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
                    <select value={k} onChange={e => updateManualKey(idx, e.target.value)}>
                      <option value="">{t("SELECT") + " " + t("COLUMN")}</option>
                      {getManualKeyOptions().map((col, i) => (
                        <option key={i} value={col}>{col}</option>
                      ))}
                    </select>
                    <button onClick={() => removeManualKey(idx)} style={{ fontSize: 16, color: "#888" }}>✖</button>
                  </span>
                ))}
                <button onClick={addManualKey} style={{ marginLeft: 8 }}>{t("ADD")}</button>
                <button onClick={() => handleMerge("manual", manualKeys)}
                  style={{ marginLeft: 10, background: "#8b5cf6", color: "white", borderRadius: 8, padding: "6px 16px", fontWeight: "bold" }}>{t("MERGE")}</button>
              </div>
            </div>
            <h2>🗂️ {t("PREVIEW")}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
              {sheetList.map((sheet, i) => (
                <div key={i} style={{ minWidth: 260, background: "#f9f9fa", borderRadius: 10, padding: 12, border: "1px solid #ececec" }}>
                  <b style={{ fontSize: 15 }}>{sheet.fileName} / {sheet.sheetName}</b>
                  <div style={{ marginTop: 7 }}>
                    <label>
                      <input type="checkbox" checked={checkedSheets[i] || false}
                        onChange={() => toggleSheet(i)}
                        style={{ accentColor: "#a78bfa", marginRight: 4 }} />
                      {t("TARGET")}
                    </label>
                  </div>
                  <table border="1" style={{ fontSize: 13, marginTop: 7, background: "#fff" }}>
                    <tbody>
                      {sheet.data.slice(0, Math.min(10, sheet.data.length)).map((row, ridx) => (
                        <tr key={ridx}>
                          <td style={{ fontSize: 12, color: "#bbb", textAlign: "right", minWidth: 25 }}>{ridx + 1}</td>
                          {row.map((cell, cidx) => (
                            <td key={cidx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                      {sheet.data.length > 10 && (
                        <tr>
                          <td colSpan={sheet.data[0]?.length + 1} style={{ color: "#aaa" }}>… {t("MORE") || "더 있음"}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div style={{ margin: "12px 0" }}>
              <button onClick={() => setAllSheets(true)} style={{ marginRight: 8 }}>{t("SELECT_ALL")}</button>
              <button onClick={() => setAllSheets(false)}>{t("UNSELECT_ALL")}</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ padding: "2rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, justifyContent: "center" }}>
              <button onClick={() => setStep(1)} style={{ background: "#f3f4f6", border: "none", padding: "8px 20px", borderRadius: 10, color: "#444", fontWeight: "bold", cursor: "pointer" }}>⬅️ {t("BACK_TO_LIST")}</button>
              <button onClick={handleCopyTable} style={{ background: "#60a5fa", color: "#fff", borderRadius: 10, padding: "0.5rem 1.2rem", fontWeight: "bold" }}>{t("COPY") || "복사"}</button>
              <button onClick={() => exportToExcel(filteredTable)} style={{ background: "#6d28d9", color: "white", borderRadius: 10, padding: "0.5rem 1.5rem", fontWeight: "bold" }}>{t("EXPORT")}</button>
              <button onClick={deleteSelectedRows} disabled={selectedRows.length === 0}
                style={{ marginLeft: 12, background: "#ef4444", color: "#fff", borderRadius: 7, padding: "8px 18px" }}>{t("DELETE_ROWS")}</button>
              <button onClick={deleteSelectedCols} disabled={selectedCols.length === 0}
                style={{ marginLeft: 12, background: "#f59e42", color: "#fff", borderRadius: 7, padding: "8px 18px" }}>{t("DELETE_COLS")}</button>
            </div>
            <h2 style={{ fontWeight: "bold" }}>🧾 {t("MERGED_TABLE")}</h2>
            {/* 검색 조건 */}
            {mergedTable.length > 0 && (
              <div style={{ marginBottom: "1rem", marginTop: 10 }}>
                <h3 style={{ marginBottom: 6 }}>🔍 {t("SEARCH_COND")}</h3>
                {filters.map((filter, idx) => (
                  <div key={idx} style={{ marginBottom: "0.5rem" }}>
                    <select value={filter.column} onChange={e => updateFilter(idx, "column", e.target.value)} style={{ minWidth: 120 }}>
                      <option value="">{t("SELECT") + " " + t("COLUMN")}</option>
                      {(groupTable || mergedTable)[0].map((col, i) => (
                        <option key={i} value={col}>{col}</option>
                      ))}
                    </select>
                    <input type="text" placeholder={t("SEARCH") || "검색어 입력"} value={filter.keyword} onChange={e => updateFilter(idx, "keyword", e.target.value)} style={{ marginLeft: "0.5rem" }} />
                    <button onClick={() => removeFilter(idx)} style={{ marginLeft: "0.5rem" }}>❌</button>
                  </div>
                ))}
                <button onClick={addFilter}>{t("ADD_COND")}</button>
              </div>
            )}
            {/* 그룹조건 */}
            <div style={{ margin: "14px 0", border: "1px solid #c7d2fe", borderRadius: 7, padding: 12, background: "#f3f4f6", minWidth: 600 }}>
              <b>{t("GROUP_BY")}</b>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 190 }}>
                  <span>{t("GROUP_COL")}: </span>
                  <MultiSelect options={getMultiOptions(mergedTable[0])}
                    value={groupKeys.map(k => ({ label: k, value: k }))}
                    onChange={opts => setGroupKeys(opts.map(o => o.value))}
                    labelledBy={t("GROUP_COL")}
                    hasSelectAll={false}
                    overrideStrings={{ "selectSomeItems": t("GROUP_COL") }} />
                </div>
                <select value={aggType} onChange={e => setAggType(e.target.value)}>
                  <option value="count">{t("COUNT")}</option>
                  <option value="sum">{t("SUM")}</option>
                  <option value="avg">{t("AVG")}</option>
                  <option value="min">{t("MIN")}</option>
                  <option value="max">{t("MAX")}</option>
                </select>
                {aggType !== "count" && (
                  <div style={{ minWidth: 190 }}>
                    <span>{t("AGG_COL")}: </span>
                    <MultiSelect options={getMultiOptions(mergedTable[0])}
                      value={aggCols.map(k => ({ label: k, value: k }))}
                      onChange={opts => setAggCols(opts.map(o => o.value))}
                      labelledBy={t("AGG_COL")}
                      hasSelectAll={false}
                      overrideStrings={{ "selectSomeItems": t("AGG_COL") }} />
                  </div>
                )}
                <button onClick={handleGroupBy}>{t("GROUP_ADD")}</button>
                {groupTable && (
                  <button onClick={() => { setGroupTable(null); setColOrder(mergedTable[0].map((_, i) => i)); setColWidths([]); }}
                    style={{ color: "#c026d3", marginLeft: 8 }}>
                    {t("GROUP_CANCEL")}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>{t("GROUP_HINT")}</div>
            </div>
            {/* 테이블 */}
            <div style={{ maxWidth: "100%", overflowX: "auto", background: "#fafafa", borderRadius: 8, border: "1px solid #eee", padding: 8, display: "flex", justifyContent: "center" }}>
              <table border="1" cellPadding="4" style={{ width: "100%", fontSize: 15 }}>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}></th>
                    {filteredTable[0]?.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        draggable
                        onDragStart={() => handleColDragStart(cIdx)}
                        onDragOver={handleColDragOver}
                        onDrop={() => handleColDrop(cIdx)}
                        style={{
                          background: selectedCols.includes(cIdx) ? "#dbeafe" : "#ede9fe",
                          cursor: "pointer",
                          userSelect: "none",
                          borderBottom: "2px solid #a5b4fc",
                          position: "relative",
                          width: (colWidths[cIdx] || 120)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCols.includes(cIdx)}
                          onClick={e => handleColCheckbox(e, cIdx)}
                          style={{ marginRight: 4 }}
                        />
                        <span
                          style={{ userSelect: "none" }}
                          onClick={e => handleHeaderClick(e, cIdx)}
                        >
                          {cell}
                          {sortState.col === (filteredTable[0]?.[cIdx] || null) &&
                            (sortState.desc ? " 🔽" : " 🔼")}
                        </span>
                        {/* 컬럼 리사이저 핸들 */}
                        <span
                          style={{
                            position: "absolute", right: 0, top: 0, width: 7, height: "100%",
                            cursor: "col-resize", userSelect: "none", zIndex: 1
                          }}
                          onMouseDown={e => startResize(cIdx, e)}
                        >
                          &nbsp;|
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTable.slice(1).map((row, rIdx) => (
                    <tr key={rIdx} style={{ background: selectedRows.includes(rIdx + 1) ? "#f3e8ff" : undefined, cursor: "pointer" }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rIdx + 1)}
                          onClick={e => toggleRowCheckbox(rIdx + 1, e)}
                        />
                      </td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}
                          style={{ width: (colWidths[cIdx] || 120), minWidth: 40, maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis" }}
                          onClick={() => (rIdx !== 0) && handleCellClick(rIdx + 1, colOrder[cIdx], cell)}
                        >
                          {editCell.row === rIdx + 1 && editCell.col === colOrder[cIdx] ? (
                            <input
                              value={editValue}
                              autoFocus
                              onChange={handleCellEdit}
                              onBlur={handleCellEditBlur}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleCellEditBlur();
                              }}
                              style={{ width: "80px" }}
                            />
                          ) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    <footer style={{
  width: "100vw",
  textAlign: "center",
  fontSize: 14,
  color: "#888",
  padding: "1.5rem 0 1rem 0",
  background: "transparent",
  marginTop: 32
}}>
  <a
    href="https://docs.google.com/document/d/e/2PACX-1vTtflKl_LyP__VFyNFbmUlHtQ1mZH1VKAszepwd1hhSymA1_dqZ2HekmjhhIu7gNVgwFNQmiOzRbUKn/pub"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: "#2563eb", textDecoration: "underline" }}
  >
    Privacy Policy
  </a>
  &nbsp;|&nbsp;
  <a
    href="https://docs.google.com/document/d/e/2PACX-1vTSUOrfnVdcg7LE03jqY3ttuiOrwHHLhbKvLqSBdOnq1J0mzgPf5hCDJ1G21KxvTHRB_1sJkI9ZclP1/pub"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: "#2563eb", textDecoration: "underline" }}
  >
    Terms of Service
  </a>
  &nbsp;|&nbsp; Contact: <a href="mailto:befive99@naver.com">befive99@naver.com</a>
</footer>
       </>
  );
}

export default App;
