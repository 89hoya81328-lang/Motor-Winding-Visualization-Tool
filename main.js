/**
     * =====================================================
     * generateDesign()
     * =====================================================
     * 사용자가 입력한 P, S, Connection 값에 따라 동적으로 UI와 도면을 업데이트합니다.
     */
    function generateDesign() {
      // --- [1단계] 사용자 입력값 가져오기 ---
      const poles = parseInt(document.getElementById('inputPoles').value) || 42;
      const slots = parseInt(document.getElementById('inputSlots').value) || 36;
      const conn = document.getElementById('inputConn').value;
      const layer = parseInt(document.getElementById('inputLayer').value) || 1;
      const parallelA = parseInt(document.getElementById('inputParallel').value) || 1;
      const neutralN = conn === 'Y' ? (parseInt(document.getElementById('inputNeutral').value) || 1) : 0;

      const resultArea = document.getElementById('resultArea');
      const deltaArea = document.getElementById('deltaSchematicArea');
      const diagramArea = document.getElementById('diagramArea');

      // 기존 상태 초기화
      diagramArea.classList.add('hidden');
      if (deltaArea) deltaArea.classList.add('hidden');

      // --- [검증] 설계 가능성 확인 ---
      if (slots % 3 !== 0) {
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 설계 불가능</div><div style="padding:24px;color:var(--text-secondary)">슬롯 수(S=${slots})가 3의 배수가 아닙니다. 3상 모터는 S가 3의 배수여야 합니다.</div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }
      if (slots % (3 * parallelA) !== 0) {
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 설계 불가능</div><div style="padding:24px;color:var(--text-secondary)">슬롯 수(S=${slots})가 3×a(=${3*parallelA})의 배수가 아닙니다. 병렬 회로 수(a=${parallelA})를 변경해 주세요.</div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }
      if (parallelA > 1 && (poles / 2) % parallelA !== 0 && poles % parallelA !== 0) {
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 설계 불가능</div><div style="padding:24px;color:var(--text-secondary)">병렬 회로 수(a=${parallelA})가 극 쌍수(p=${poles/2})와 호환되지 않습니다. a는 극 쌍수의 약수여야 합니다.</div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }
      if (conn === 'Y' && neutralN > parallelA) {
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 설계 불가능</div><div style="padding:24px;color:var(--text-secondary)">중성점 개수(N=${neutralN})가 병렬 회로 수(a=${parallelA})보다 클 수 없습니다.</div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }

      // --- 범용 권선 알고리즘 (슬롯 성형도 이론 적용) ---
      const slotMap = {};
      const slotData = {}; // { num: { left: {phase, dir}, right: {phase, dir} } }
      for (let i = 1; i <= slots; i++) {
        slotData[i] = { left: null, right: null };
      }
      const phaseSlots = { U: [], V: [], W: [] };
      
      const q = slots / (3 * poles);
      const isConcentrated = (q < 1);

      if (isConcentrated) {
        // [A] 집중권 (FSCW) - 단층(Single) 또는 복층(Double)
        // 각 이빨(tooth)에 독립적으로 상과 방향을 배정
        // 단층(layer=1)일 경우 건너뛰며(t+=2) 배정, 복층(layer=2)일 경우 모든 이빨(t+=1) 배정
        const p = poles / 2;
        const alphaSlot = p * 360 / slots; // 슬롯 전기각 간격
        
        const step = layer === 1 ? 2 : 1; // 단층이면 2칸씩 건너뜀
        
        for (let t = 1; t <= slots; t += step) {
          const thetaRaw = (t - 1) * p * (360 / slots); // 원시 전기각 (모듈러 없음)
          const thetaMod = ((thetaRaw % 360) + 360) % 360;
          
          let phase = '', dir = '';
          
          // 표준 6-zone 배정 (모든 집중권에 범용적으로 적용)
          let zone = Math.floor((thetaMod + 1e-5) / 60) % 6;
          if (zone === 0) { phase = 'U'; dir = 'go'; }
          else if (zone === 1) { phase = 'W'; dir = 'return'; }
          else if (zone === 2) { phase = 'V'; dir = 'go'; }
          else if (zone === 3) { phase = 'U'; dir = 'return'; }
          else if (zone === 4) { phase = 'W'; dir = 'go'; }
          else if (zone === 5) { phase = 'V'; dir = 'return'; }
          
          const s1 = t;
          const s2 = (t % slots) + 1;
          
          // 슬롯맵: 첫 배정된 상으로 기록 (기존 로직 호환 유지)
          if (!slotMap[s1]) slotMap[s1] = phase;
          if (!slotMap[s2]) slotMap[s2] = phase;
          
          if (dir === 'go') { 
            phaseSlots[phase].push([s1, s2]); 
            slotData[s1].right = { phase: phase, dir: 'go' };
            slotData[s2].left = { phase: phase, dir: 'return' };
          } else { 
            phaseSlots[phase].push([s2, s1]); 
            slotData[s1].right = { phase: phase, dir: 'return' };
            slotData[s2].left = { phase: phase, dir: 'go' };
          }
        }
      } else {
        const phaseLists = { U: { go: [], return: [] }, V: { go: [], return: [] }, W: { go: [], return: [] } };
        for (let k = 1; k <= slots; k++) {
          let theta = ((k - 1) * (poles / 2) * (360 / slots)) % 360;
          if (theta < 0) theta += 360;
          let zone = Math.floor((theta + 1e-6) / 60) % 6;
          let phase = '', dir = '';
          if (zone === 0) { phase = 'U'; dir = 'go'; }
          else if (zone === 1) { phase = 'W'; dir = 'return'; }
          else if (zone === 2) { phase = 'V'; dir = 'go'; }
          else if (zone === 3) { phase = 'U'; dir = 'return'; }
          else if (zone === 4) { phase = 'W'; dir = 'go'; }
          else if (zone === 5) { phase = 'V'; dir = 'return'; }
          slotMap[k] = phase;
          phaseLists[phase][dir].push(k);
        }
        const y = Math.max(1, Math.round(slots / poles));
        ['U', 'V', 'W'].forEach(phase => {
          const goList = phaseLists[phase].go;
          const returnList = phaseLists[phase].return;
          const usedReturn = new Set();
          goList.sort((a, b) => a - b);
          for (let g of goList) {
            let rPlus = (g + y - 1) % slots + 1;
            let rMinus = (g - y - 1 + slots * 10) % slots + 1;
            let matchedR = null;
            if (returnList.includes(rPlus) && !usedReturn.has(rPlus)) {
              matchedR = rPlus;
            } else if (returnList.includes(rMinus) && !usedReturn.has(rMinus)) {
              matchedR = rMinus;
            } else {
              let minDist = Infinity;
              for (let r of returnList) {
                if (usedReturn.has(r)) continue;
                let dist1 = Math.abs(g - r);
                let dist2 = slots - dist1;
                let dist = Math.min(dist1, dist2);
                if (dist < minDist) { minDist = dist; matchedR = r; }
              }
            }
            if (matchedR !== null) {
              usedReturn.add(matchedR);
              phaseSlots[phase].push([g, matchedR]);
              slotData[g].left = { phase: phase, dir: 'go' };
              slotData[g].right = null;
              slotData[matchedR].left = { phase: phase, dir: 'return' };
              slotData[matchedR].right = null;
            }
          }
        });
      }

      // --- [후속 검증] 코일 수 vs 병렬 회로 수 ---
      const coilsPerPhase = Math.min(phaseSlots['U'].length, phaseSlots['V'].length, phaseSlots['W'].length);
      if (parallelA > coilsPerPhase) {
        const maxA = coilsPerPhase;
        let suggestionHtml = '';
        if (layer === 1) {
          suggestionHtml = `
            <div style="margin-top:16px; padding:12px; background:rgba(43,212,187,0.1); border-left:4px solid var(--accent-cyan); border-radius:4px;">
              💡 <b>해결 방법:</b> 현재 <b>단층(Single Layer)</b>으로 설정되어 있어 총 코일 수가 절반으로 제한되었습니다.<br>
              ${parallelA}병렬 구성을 원하신다면, 아래 버튼을 눌러 <b>복층(Double Layer)</b>으로 변경하세요!
              <button onclick="document.getElementById('inputLayer').value='2'; generateDesign();" style="margin-top:12px; padding:8px 16px; background:var(--accent-cyan); color:#0b131a; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                복층(Double Layer)으로 변경하여 계속하기
              </button>
            </div>
          `;
        }
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 설계 불가능</div><div style="padding:24px;color:var(--text-secondary)">이 조합(${poles}P ${slots}S)은 상(Phase)당 코일이 <b>${coilsPerPhase}개</b>뿐입니다.<br>병렬 회로 수(a=${parallelA})가 코일 수보다 많으면 빈 분기가 생깁니다.<br><br>💡 <b>현재 가능한 최대 a = ${maxA}</b> (코일 수의 약수: ${Array.from({length: maxA}, (_, i) => i + 1).filter(x => coilsPerPhase % x === 0).join(', ')})${suggestionHtml}</div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }
      if (parallelA > 1 && coilsPerPhase % parallelA !== 0) {
        resultArea.innerHTML = `<section class="card"><div class="card-title" style="color:#ff4d6a">⚠️ 불균형 경고</div><div style="padding:24px;color:var(--text-secondary)">상당 코일 수(${coilsPerPhase})가 병렬 회로 수(a=${parallelA})로 균등 분할되지 않습니다.<br>전기적 불평형이 발생할 수 있습니다.<br><br>💡 <b>추천 a 값: ${Array.from({length: coilsPerPhase}, (_, i) => i + 1).filter(x => coilsPerPhase % x === 0).join(', ')}</b></div></section>`;
        resultArea.classList.remove('hidden');
        return;
      }

      // --- [WINDING_MAP 구조] 병렬 회로 분기 ---
      // 각 상의 코일을 a개의 병렬 분기로 균등 분배
      const WINDING_MAP = { U: [], V: [], W: [] };
      ['U', 'V', 'W'].forEach(phase => {
        const allPairs = phaseSlots[phase];
        const perBranch = Math.floor(allPairs.length / parallelA);
        const remainder = allPairs.length % parallelA;
        let idx = 0;
        for (let b = 0; b < parallelA; b++) {
          const count = perBranch + (b < remainder ? 1 : 0);
          WINDING_MAP[phase].push({
            branch: b + 1,
            coils: allPairs.slice(idx, idx + count),
            neutralIdx: neutralN > 0 ? (b % neutralN) : -1
          });
          idx += count;
        }
      });

      // 3. UI 및 도면 업데이트
      const maxGroups = Math.max(phaseSlots['U'].length, phaseSlots['V'].length, phaseSlots['W'].length);
      resultArea.innerHTML = buildResultHTML(phaseSlots, slotMap, slots, maxGroups, WINDING_MAP, parallelA, neutralN);
      resultArea.classList.remove('hidden');

      drawStator(slots, slotMap, phaseSlots, poles, conn, WINDING_MAP, parallelA, neutralN, slotData);
      diagramArea.classList.remove('hidden');

      // Motor-CAD 스타일 전개 결선도
      const devArea = document.getElementById('developedDiagramArea');
      drawDevelopedDiagram(slots, slotData, phaseSlots, poles, conn, WINDING_MAP, parallelA, neutralN);
      devArea.classList.remove('hidden');
      
      if (deltaArea && conn === 'Delta') {
        drawDeltaSchematic(phaseSlots);
        deltaArea.classList.remove('hidden');
      }

      resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }



    /**
     * =====================================================
     * buildResultHTML()
     * =====================================================
     * 계산된 데이터를 기반으로 결과 HTML을 조립합니다.
     * 3개의 섹션으로 구성됩니다:
     *   1) 요약 카드 - 각 상별 슬롯 개수
     *   2) 상세 테이블 - 코일 그룹별 슬롯 쌍
     *   3) 전체 슬롯 배치 테이블 - 1~36번 슬롯 맵
     */
    function buildResultHTML(phaseSlots, slotMap, totalSlots, groupCount, WINDING_MAP, parallelA, neutralN) {
      let html = '';

      // ---- 섹션 0: 설계 사양 검증 카드 ----
      const coilsPP = Math.min(phaseSlots['U'].length, phaseSlots['V'].length, phaseSlots['W'].length);
      const windType = coilsPP > totalSlots / 6 ? '복층 집중권 (Double-Layer FSCW)' : '분포권 (Distributed)';
      const coilsPerBr = Math.floor(coilsPP / parallelA);
      const validAList = Array.from({length: coilsPP}, (_, i) => i + 1).filter(x => coilsPP % x === 0);
      html += `
        <section class="card" style="animation-delay:0.05s">
          <div class="card-title"><span class="icon">🔍</span> 설계 검증 (Design Verification)</div>
          <table class="spec-table">
            <tr><th>권선 유형</th><td><span class="badge badge-cyan">${windType}</span></td></tr>
            <tr><th>상당 코일 수</th><td>${coilsPP}개 / Phase</td></tr>
            <tr><th>병렬 회로 수 (a)</th><td>${parallelA} ${parallelA > 1 ? `(분기당 ${coilsPerBr}코일)` : '(직렬)'}</td></tr>
            ${neutralN > 0 ? `<tr><th>중성점 개수 (N)</th><td>${neutralN}개 ${neutralN > 1 ? '(N1~N' + neutralN + ')' : '(N)'}</td></tr>` : ''}
            <tr><th>사용 가능한 a 값</th><td style="color:var(--accent-cyan)">${validAList.join(', ')}</td></tr>
          </table>
        </section>`;

      // ---- 섹션 1: 요약 카드 ----
      html += `
        <section class="card" style="animation-delay:0.1s">
          <div class="card-title"><span class="icon">📊</span> 상별 요약 (Phase Summary)</div>
          <div class="summary-grid">
            <div class="summary-item u">
              <div class="label">Phase U</div>
              <div class="value">${phaseSlots['U'].length * 2}</div>
              <div class="sub">슬롯 (${phaseSlots['U'].length}코일) · ${parallelA > 1 ? parallelA + '병렬' : '직렬'}</div>
            </div>
            <div class="summary-item v">
              <div class="label">Phase V</div>
              <div class="value">${phaseSlots['V'].length * 2}</div>
              <div class="sub">슬롯 (${phaseSlots['V'].length}코일) · ${parallelA > 1 ? parallelA + '병렬' : '직렬'}</div>
            </div>
            <div class="summary-item w">
              <div class="label">Phase W</div>
              <div class="value">${phaseSlots['W'].length * 2}</div>
              <div class="sub">슬롯 (${phaseSlots['W'].length}코일) · ${parallelA > 1 ? parallelA + '병렬' : '직렬'}</div>
            </div>
          </div>
        </section>`;

      // ---- 섹션 2: 상세 코일 그룹 테이블 ----
      html += `
        <section class="card" style="animation-delay:0.2s">
          <div class="card-title"><span class="icon">🔌</span> 코일 그룹 상세 (Coil Group Detail)</div>
          <table class="result-table">
            <thead>
              <tr>
                <th>코일 그룹</th>
                <th class="phase-u-head">Phase U</th>
                <th class="phase-v-head">Phase V</th>
                <th class="phase-w-head">Phase W</th>
              </tr>
            </thead>
            <tbody>`;

      for (let i = 0; i < groupCount; i++) {
        const uPair = phaseSlots['U'][i];
        const vPair = phaseSlots['V'][i];
        const wPair = phaseSlots['W'][i];
        const uStr = uPair ? `${uPair[0]}-${uPair[1]}` : '-';
        const vStr = vPair ? `${vPair[0]}-${vPair[1]}` : '-';
        const wStr = wPair ? `${wPair[0]}-${wPair[1]}` : '-';
        html += `
              <tr>
                <td style="color:var(--text-secondary)">#${i + 1}</td>
                <td><span class="slot-pair slot-u">${uStr}</span></td>
                <td><span class="slot-pair slot-v">${vStr}</span></td>
                <td><span class="slot-pair slot-w">${wStr}</span></td>
              </tr>`;
      }

      // 하단 요약 행
      html += `
              <tr style="background:rgba(0,0,0,0.15)">
                <td style="font-weight:700;color:var(--text-secondary)">전체</td>
                <td style="font-weight:700;color:var(--phase-u)">${phaseSlots['U'].map(p => p.join('-')).join(', ')}</td>
                <td style="font-weight:700;color:var(--phase-v)">${phaseSlots['V'].map(p => p.join('-')).join(', ')}</td>
                <td style="font-weight:700;color:var(--phase-w)">${phaseSlots['W'].map(p => p.join('-')).join(', ')}</td>
              </tr>
            </tbody>
          </table>
        </section>`;

      // ---- 섹션 2.5: 병렬 분기 상세 (a > 1일 때만) ----
      if (parallelA > 1) {
        html += `
        <section class="card" style="animation-delay:0.25s">
          <div class="card-title"><span class="icon">🔀</span> 병렬 분기 상세 (Parallel Branches: a=${parallelA}${neutralN > 0 ? ', N=' + neutralN : ''})</div>
          <div style="padding:20px;overflow-x:auto">
            <table class="result-table" style="min-width:100%">
              <thead>
                <tr>
                  <th>분기 #</th>
                  <th class="phase-u-head">Phase U</th>
                  <th class="phase-v-head">Phase V</th>
                  <th class="phase-w-head">Phase W</th>
                  ${neutralN > 0 ? '<th>중성점</th>' : ''}
                </tr>
              </thead>
              <tbody>`;
        for (let b = 0; b < parallelA; b++) {
          const uBranch = WINDING_MAP['U'][b];
          const vBranch = WINDING_MAP['V'][b];
          const wBranch = WINDING_MAP['W'][b];
          html += `
                <tr>
                  <td style="font-weight:700;color:var(--text-secondary)">Branch ${b + 1}</td>
                  <td><span class="slot-pair slot-u">${uBranch.coils.map(p => p.join('-')).join(', ')}</span></td>
                  <td><span class="slot-pair slot-v">${vBranch.coils.map(p => p.join('-')).join(', ')}</span></td>
                  <td><span class="slot-pair slot-w">${wBranch.coils.map(p => p.join('-')).join(', ')}</span></td>
                  ${neutralN > 0 ? `<td style="color:#88aadd;font-weight:700">N${uBranch.neutralIdx + 1}</td>` : ''}
                </tr>`;
        }
        html += `
              </tbody>
            </table>
          </div>
        </section>`;
      }

      // ---- 섹션 3: 전체 슬롯 배치 맵 ----
      html += `
        <section class="card" style="animation-delay:0.3s">
          <div class="card-title"><span class="icon">🗺️</span> 슬롯 배치 맵 (Slot Map: 1~${totalSlots})</div>
          <div style="padding:20px;overflow-x:auto">
            <table class="result-table" style="min-width:100%">
              <thead><tr><th>슬롯 #</th><th>상 (Phase)</th><th>코일 그룹</th></tr></thead>
              <tbody>`;

      for (let s = 1; s <= totalSlots; s++) {
        const phase = slotMap[s];
        const cls = phase === 'U' ? 'u' : phase === 'V' ? 'v' : 'w';
        const color = phase === 'U' ? 'var(--phase-u)' : phase === 'V' ? 'var(--phase-v)' : 'var(--phase-w)';
        // 코일 그룹 번호 계산
        const groupIdx = phaseSlots[phase].findIndex(pair => pair.includes(s));
        html += `
                <tr>
                  <td style="font-weight:700">${s}</td>
                  <td><span class="badge badge-${cls}">Phase ${phase}</span></td>
                  <td style="color:${color}">#${groupIdx + 1}</td>
                </tr>`;
      }

      html += `
              </tbody>
            </table>
          </div>
        </section>`;

      return html;
    }

    /**
     * =====================================================
     * drawStator(totalSlots, slotMap, phaseSlots, poles)
     * =====================================================
     * 스태터 단면도 + 코일 배선 곡선 + 델타 결선 단자를 그립니다.
     */
    function drawStator(totalSlots, slotMap, phaseSlots, poles, conn, WINDING_MAP, parallelA, neutralN, slotData) {
      const ns = 'http://www.w3.org/2000/svg';
      const svgW = 1870, svgH = 1870;
      const cx = 935, cy = 935;
      const outerR = 425, innerR = 220, slotR = 357;
      const slotW = 41, slotH = 88, labelR = 468;
      const angleStep = (2 * Math.PI) / totalSlots;
      const startAngle = -Math.PI / 2;

      // 상별 색상 설정
      const phaseColors = { U: '#FF3333', V: '#4488FF', W: '#33DD55' };
      const phaseSlotFill = { U: '#cc3333', V: '#3355cc', W: '#33aa44' };

      // === Hybrid C: 코일=외측 / 점퍼=보어 / 중성점 별도색 ===
      const phaseCoilOffset    = { U: 25, V: 60, W: 95 };   // 외측 코일 호 (outerR 기준)
      const phaseJumperInset   = { U: 30, V: 50, W: 70 };   // 보어 내측 점퍼 (innerR 기준)
      const phaseBusR          = { U: outerR + 165, V: outerR + 200, W: outerR + 235 };
      const neutralBusR        = outerR + 275;
      const neutralWireColor   = '#B179DB';

      // SVG 생성
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('id', 'statorSvg');
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', 'auto');

      // --- Stator iron core (annular ring) ---
      const ironCore = document.createElementNS(ns, 'circle');
      ironCore.setAttribute('cx', cx); ironCore.setAttribute('cy', cy);
      ironCore.setAttribute('r', outerR);
      ironCore.style.fill = '#6e7c8a';
      ironCore.style.stroke = '#94a3b3';
      ironCore.style.strokeWidth = '1.5';
      ironCore.style.strokeOpacity = '0.7';
      svg.appendChild(ironCore);
      // --- Bore (air gap) ---
      const bore = document.createElementNS(ns, 'circle');
      bore.setAttribute('cx', cx); bore.setAttribute('cy', cy);
      bore.setAttribute('r', innerR);
      bore.style.fill = '#0a1828';
      bore.style.stroke = '#3a4a5a';
      bore.style.strokeWidth = '1.2';
      bore.style.strokeOpacity = '0.6';
      svg.appendChild(bore);

      // --- 슬롯 좌표 저장용 배열 ---
      const slotInnerLeft = [];
      const slotInnerRight = [];
      const slotOuterLeft = [];
      const slotOuterRight = [];
      const slotInner = []; // Fallback for center
      const slotOuter = []; // Fallback for center

      function getSlotSide(slotA, slotB) {
        if (slotA === totalSlots && slotB === 1) return 'right';
        if (slotA === 1 && slotB === totalSlots) return 'left';
        let diff = slotB - slotA;
        if (diff > totalSlots / 2) diff -= totalSlots;
        if (diff < -totalSlots / 2) diff += totalSlots;
        return diff > 0 ? 'right' : 'left';
      }

      function getInnerCoord(slotNum, side) {
        return side === 'left' ? slotInnerLeft[slotNum] : slotInnerRight[slotNum];
      }
      function getOuterCoord(slotNum, side) {
        return side === 'left' ? slotOuterLeft[slotNum] : slotOuterRight[slotNum];
      }

      // --- 헬퍼: Motor-CAD 스타일 전류 방향 마커 ---
      // 색상 배경 원 + 백색 ⊙(Dot: 나옴) / ⊗(Cross: 들어감) 기호
      function createMarker(dir, color, offsetX, radius) {
        const r = radius || 9;
        const markG = document.createElementNS(ns, 'g');
        markG.setAttribute('pointer-events', 'none');
        markG.setAttribute('transform', `translate(${offsetX}, 0)`);

        const bg = document.createElementNS(ns, 'circle');
        bg.setAttribute('cx', 0); bg.setAttribute('cy', 0); bg.setAttribute('r', r);
        bg.setAttribute('fill', '#0a1828');
        bg.setAttribute('stroke', color); bg.setAttribute('stroke-width', '2.2');
        markG.appendChild(bg);

        const symR = r * 0.62;
        if (dir === 'go') {
          // ⊗ — 들어감
          [[-symR,-symR,symR,symR],[-symR,symR,symR,-symR]].forEach(([x1,y1,x2,y2])=>{
            const ln = document.createElementNS(ns,'line');
            ln.setAttribute('x1',x1); ln.setAttribute('y1',y1);
            ln.setAttribute('x2',x2); ln.setAttribute('y2',y2);
            ln.setAttribute('stroke', color); ln.setAttribute('stroke-width', '2.4');
            ln.setAttribute('stroke-linecap','round');
            markG.appendChild(ln);
          });
        } else {
          // ⊙ — 나옴
          const d = document.createElementNS(ns,'circle');
          d.setAttribute('cx', 0); d.setAttribute('cy', 0);
          d.setAttribute('r', symR * 0.55);
          d.setAttribute('fill', color);
          markG.appendChild(d);
        }
        return markG;
      }

      // --- 슬롯 배치 + Motor-CAD 스타일 착색 + 방향 표식 ---
      for (let i = 0; i < totalSlots; i++) {
        const num = i + 1;
        const angle = startAngle + i * angleStep;
        const sx = cx + slotR * Math.cos(angle);
        const sy = cy + slotR * Math.sin(angle);
        const rotDeg = (angle * 180 / Math.PI) + 90;

        // 슬롯 안쪽/바깥쪽 끝점 계산
        const inR = slotR - slotH / 2;
        const outR = slotR + slotH / 2;
        const D = slotW / 4;

        const pxIn = cx + inR * Math.cos(angle);
        const pyIn = cy + inR * Math.sin(angle);
        slotInner[num] = { x: pxIn, y: pyIn };
        slotInnerLeft[num] = { x: pxIn + D * Math.sin(angle), y: pyIn - D * Math.cos(angle) };
        slotInnerRight[num] = { x: pxIn - D * Math.sin(angle), y: pyIn + D * Math.cos(angle) };

        const pxOut = cx + outR * Math.cos(angle);
        const pyOut = cy + outR * Math.sin(angle);
        slotOuter[num] = { x: pxOut, y: pyOut };
        slotOuterLeft[num] = { x: pxOut + D * Math.sin(angle), y: pyOut - D * Math.cos(angle) };
        slotOuterRight[num] = { x: pxOut - D * Math.sin(angle), y: pyOut + D * Math.cos(angle) };

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${sx},${sy}) rotate(${rotDeg})`);
        const sd = slotData ? slotData[num] : null;
        const halfW = slotW / 2;
        const isDoubleLayer = sd && sd.left && sd.left.dir && sd.right && sd.right.dir;

        // 슬롯 path (shoe 형상): 요크측 캡슐 + 보어측 좁은 입구
        const cornerR = halfW;
        const shoeStart = slotH / 2 - slotH * 0.18;
        const shoeEnd   = slotH / 2 - slotH * 0.06;
        const openHalfW = halfW * 0.45;
        const slotPath = `M ${-halfW} ${-slotH/2 + cornerR} ` +
                         `A ${cornerR} ${cornerR} 0 0 1 ${halfW} ${-slotH/2 + cornerR} ` +
                         `L ${halfW} ${shoeStart.toFixed(1)} ` +
                         `L ${openHalfW.toFixed(1)} ${shoeEnd.toFixed(1)} ` +
                         `L ${openHalfW.toFixed(1)} ${slotH/2} ` +
                         `L ${-openHalfW.toFixed(1)} ${slotH/2} ` +
                         `L ${-openHalfW.toFixed(1)} ${shoeEnd.toFixed(1)} ` +
                         `L ${-halfW} ${shoeStart.toFixed(1)} Z`;

        if (isDoubleLayer) {
          const clipId = `slot-clip-${num}`;
          const cp = document.createElementNS(ns, 'clipPath');
          cp.setAttribute('id', clipId);
          const cpath = document.createElementNS(ns, 'path');
          cpath.setAttribute('d', slotPath);
          cp.appendChild(cpath);
          g.appendChild(cp);

          const fillG = document.createElementNS(ns, 'g');
          fillG.setAttribute('clip-path', `url(#${clipId})`);
          ['left', 'right'].forEach((k, idx) => {
            const r = document.createElementNS(ns, 'rect');
            r.setAttribute('x', idx === 0 ? -halfW : 0);
            r.setAttribute('y', -slotH/2);
            r.setAttribute('width', halfW); r.setAttribute('height', slotH);
            r.setAttribute('fill', phaseColors[sd[k].phase]);
            r.setAttribute('fill-opacity', '0.7');
            fillG.appendChild(r);
          });
          g.appendChild(fillG);

          const border = document.createElementNS(ns, 'path');
          border.setAttribute('d', slotPath);
          border.setAttribute('fill', 'none');
          border.setAttribute('stroke', '#dde5ee');
          border.setAttribute('stroke-width', '1.5');
          border.setAttribute('stroke-opacity', '0.85');
          g.appendChild(border);

          const div = document.createElementNS(ns, 'line');
          div.setAttribute('x1', 0); div.setAttribute('y1', -slotH/2 + cornerR);
          div.setAttribute('x2', 0); div.setAttribute('y2', shoeStart);
          div.setAttribute('stroke', '#dde5ee'); div.setAttribute('stroke-width', '0.8');
          div.setAttribute('stroke-opacity', '0.55'); div.setAttribute('stroke-dasharray', '3,2');
          g.appendChild(div);

          const mR = Math.min(halfW * 0.6, slotH * 0.13);
          g.appendChild(createMarker(sd.left.dir,  phaseColors[sd.left.phase],  -halfW/2, mR));
          g.appendChild(createMarker(sd.right.dir, phaseColors[sd.right.phase],  halfW/2, mR));
        } else {
          const sideData = (sd && sd.left) ? sd.left : ((sd && sd.right) ? sd.right : null);
          const phaseColor = sideData ? phaseColors[sideData.phase] : '#5a6b7c';

          const fill = document.createElementNS(ns, 'path');
          fill.setAttribute('d', slotPath);
          fill.setAttribute('fill', phaseColor);
          fill.setAttribute('fill-opacity', sideData ? '0.65' : '0.18');
          g.appendChild(fill);

          const border = document.createElementNS(ns, 'path');
          border.setAttribute('d', slotPath);
          border.setAttribute('fill', 'none');
          border.setAttribute('stroke', phaseColor);
          border.setAttribute('stroke-width', '2');
          border.setAttribute('stroke-opacity', sideData ? '0.95' : '0.4');
          g.appendChild(border);

          if (sideData && sideData.dir) {
            const mR = Math.min(halfW * 0.7, slotH * 0.14);
            g.appendChild(createMarker(sideData.dir, phaseColors[sideData.phase], 0, mR));
          }
        }
        svg.appendChild(g);

        // 슬롯 번호
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', lx); lbl.setAttribute('y', ly);
        lbl.setAttribute('class', 'slot-label');
        lbl.textContent = num;
        svg.appendChild(lbl);
      }

      // --- 중심 텍스트 ---
      const ctGroup = document.createElementNS(ns, 'g');
      
      const ct1 = document.createElementNS(ns, 'text');
      ct1.setAttribute('x', cx); ct1.setAttribute('y', cy - 12);
      ct1.setAttribute('text-anchor', 'middle');
      ct1.setAttribute('fill', '#5a6f8a'); ct1.setAttribute('font-size', '36');
      ct1.setAttribute('font-weight', '700');
      ct1.textContent = `${poles || '?'}P / ${totalSlots}S`;
      ctGroup.appendChild(ct1);

      const ct2 = document.createElementNS(ns, 'text');
      ct2.setAttribute('x', cx); ct2.setAttribute('y', cy + 30);
      ct2.setAttribute('text-anchor', 'middle');
      ct2.setAttribute('fill', '#88aadd'); ct2.setAttribute('font-size', '22');
      ct2.setAttribute('font-weight', '600');
      
      let centerSubText = `${conn === 'Delta' ? 'Delta (Δ)' : 'Star (Y)'} 결선 | a=${parallelA}`;
      if (conn !== 'Delta' && neutralN > 0) {
        centerSubText += ` | N=${neutralN}`;
      }
      ct2.textContent = centerSubText;
      ctGroup.appendChild(ct2);

      svg.appendChild(ctGroup);

      // ================================================================
      // ANSYS-Grade Winding Arc Rendering
      // Rule 1: Top(Out,⊙)/Bottom(In,⊗) dual-layer slot coords
      // Rule 2: Phase radius offset (U +20, V +45, W +70)
      // Rule 3: Coil arcs INSIDE (bore), Jumpers OUTSIDE (yoke)
      // Rule 4: Engineering bezier - perpendicular exit from slot
      // ================================================================

      // --- 2층 슬롯 좌표 (Top=외경쪽=Out/⊙, Bottom=내경쪽=In/⊗) ---
      const slotTop = [];    // Out(⊙) 접속점 — 외경쪽 끝
      const slotBottom = []; // In(⊗) 접속점 — 내경쪽 끝
      for (let i = 1; i <= totalSlots; i++) {
        const ang = slotAngle(i);
        const topR = slotR + slotH * 0.35;   // 외경쪽 (Out)
        const botR = slotR - slotH * 0.35;   // 내경쪽 (In)
        slotTop[i] = { x: cx + topR * Math.cos(ang), y: cy + topR * Math.sin(ang), ang: ang };
        slotBottom[i] = { x: cx + botR * Math.cos(ang), y: cy + botR * Math.sin(ang), ang: ang };
      }

      // --- 헬퍼: 애니메이션이 적용된 path 생성 ---
      let animDelay = 0;
      function makeWire(d, cls, extraCls, len) {
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', cls + (extraCls ? ' ' + extraCls : ''));
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.style.setProperty('--dash-len', len);
        p.classList.add('animated-wire');
        p.style.animationDelay = `${animDelay}s`;
        animDelay += 0.025;
        return p;
      }

      // --- 슬롯 각도 조회 헬퍼 ---
      function slotAngle(slotNum) {
        return startAngle + (slotNum - 1) * angleStep;
      }



      // --- 헬퍼: 슬롯에서 수직으로 이탈하는 엔지니어링 베지어 (Rule 4) ---
      // exitR: 슬롯 끝에서 수직으로 나가는 반지름
      // arcR: 곡선이 따라가는 원형 궤도 반지름
      function makeCoilArc(fromSlot, toSlot, phase, phIdx) {
        const fromPt = slotTop[fromSlot];   // 외측 연결 (Hybrid)
        const toPt   = slotTop[toSlot];
        if (!fromPt || !toPt) return null;
        const ang1 = fromPt.ang, ang2 = toPt.ang;
        let angDiff = ang2 - ang1;
        while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
        while (angDiff < -Math.PI) angDiff += 2 * Math.PI;

        const coilR = outerR + phaseCoilOffset[phase] + Math.abs(angDiff) * 8;
        const midAng = ang1 + angDiff / 2;
        const exitR = outerR + 8;

        const ex1x = cx + exitR * Math.cos(ang1), ex1y = cy + exitR * Math.sin(ang1);
        const ex2x = cx + exitR * Math.cos(ang2), ex2y = cy + exitR * Math.sin(ang2);
        const cpX  = cx + coilR * Math.cos(midAng), cpY  = cy + coilR * Math.sin(midAng);

        const d = `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)} ` +
                  `L ${ex1x.toFixed(1)} ${ex1y.toFixed(1)} ` +
                  `Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${ex2x.toFixed(1)} ${ex2y.toFixed(1)} ` +
                  `L ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`;
        return {
          d,
          p0: { x: ex1x, y: ex1y },
          p1: { x: cpX,  y: cpY  },
          p2: { x: ex2x, y: ex2y }
        };
      }

      function makeJumperArc(fromSlot, toSlot, phase, phIdx) {
        const fromPt = slotBottom[fromSlot];   // 내측 연결 (Hybrid)
        const toPt   = slotBottom[toSlot];
        if (!fromPt || !toPt) return null;
        const ang1 = fromPt.ang, ang2 = toPt.ang;
        let angDiff = ang2 - ang1;
        while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
        while (angDiff < -Math.PI) angDiff += 2 * Math.PI;

        const jR = innerR - phaseJumperInset[phase] - Math.abs(angDiff) * 6;
        const exitR = innerR + 12;   // 보어 진입 직전

        const ex1x = cx + exitR * Math.cos(ang1), ex1y = cy + exitR * Math.sin(ang1);
        const ex2x = cx + exitR * Math.cos(ang2), ex2y = cy + exitR * Math.sin(ang2);
        const cp1x = cx + jR * Math.cos(ang1),    cp1y = cy + jR * Math.sin(ang1);
        const cp2x = cx + jR * Math.cos(ang2),    cp2y = cy + jR * Math.sin(ang2);

        const d = `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)} ` +
                  `L ${ex1x.toFixed(1)} ${ex1y.toFixed(1)} ` +
                  `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${ex2x.toFixed(1)} ${ex2y.toFixed(1)} ` +
                  `L ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`;
        return {
          d,
          p0: { x: ex1x, y: ex1y },
          p1: { x: cp1x, y: cp1y },
          p2: { x: cp2x, y: cp2y },
          p3: { x: ex2x, y: ex2y }
        };
      }

      // 슬롯 좌/우 반쪽 좌표 헬퍼 — slotData 참조해서 phase+dir 일치하는 반쪽 반환
      function getSlotConnectPt(slotNum, phase, dir, r) {
        const sd = slotData ? slotData[slotNum] : null;
        const ang = slotAngle(slotNum);
        const D = slotW / 4;
        let half = 'center';
        if (sd) {
          if (sd.left && sd.left.phase === phase && sd.left.dir === dir) half = 'left';
          else if (sd.right && sd.right.phase === phase && sd.right.dir === dir) half = 'right';
          else if (sd.left && !sd.right && sd.left.phase === phase) half = 'left';
          else if (sd.right && !sd.left && sd.right.phase === phase) half = 'right';
          else if (sd.left && sd.left.phase === phase) half = 'left';
          else if (sd.right && sd.right.phase === phase) half = 'right';
        }
        let x = cx + r * Math.cos(ang);
        let y = cy + r * Math.sin(ang);
        if (half === 'left')  { x += D * Math.sin(ang); y -= D * Math.cos(ang); }
        if (half === 'right') { x -= D * Math.sin(ang); y += D * Math.cos(ang); }
        return { x, y, ang };
      }

      // 코일 페어 전용 — 슬롯 입구(visible edge)에서 연결, 보어로 dive
      function makeCoilPairArc(fromSlot, toSlot, phase, phIdx) {
        const ang1 = slotAngle(fromSlot);
        const ang2 = slotAngle(toSlot);
        const openingR = slotR - slotH / 2;   // 313 — 실제 슬롯 입구
        const fromPt = getSlotConnectPt(fromSlot, phase, 'go', openingR);
        const toPt   = getSlotConnectPt(toSlot, phase, 'return', openingR);

        let angDiff = ang2 - ang1;
        while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
        while (angDiff < -Math.PI) angDiff += 2 * Math.PI;

        const layerOff = phIdx * 18;   // 상별 동심 레이어
        const midR = Math.max(60, innerR - 30 - layerOff - Math.abs(angDiff) * 6);
        const midAng = ang1 + angDiff / 2;
        const cpX = cx + midR * Math.cos(midAng);
        const cpY = cy + midR * Math.sin(midAng);

        const d = `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)} ` +
                  `Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`;
        return { d };
      }

      // === Phase 1: 터미널→슬롯 동심원 라우팅 ===
      function makeTerminalRoute(termPt, slotNum, busR, fromTop, slotPtOverride) {
        const slotAng = slotAngle(slotNum);
        const entryAng = fromTop ? -Math.PI / 2 : Math.PI / 2;
        const entryX = cx + busR * Math.cos(entryAng);
        const entryY = cy + busR * Math.sin(entryAng);

        let dAng = slotAng - entryAng;
        while (dAng > Math.PI) dAng -= 2 * Math.PI;
        while (dAng < -Math.PI) dAng += 2 * Math.PI;
        const sweepFlag = dAng > 0 ? 1 : 0;
        const largeArc = Math.abs(dAng) > Math.PI ? 1 : 0;

        const arcEndX = cx + busR * Math.cos(slotAng);
        const arcEndY = cy + busR * Math.sin(slotAng);
        const slotPt = slotPtOverride || slotTop[slotNum];
        if (!slotPt) return null;

        const dropY = termPt.y + (fromTop ? 40 : -40);
        const cp2x = (termPt.x + entryX) / 2;

        return `M ${termPt.x.toFixed(1)} ${termPt.y.toFixed(1)} ` +
               `L ${termPt.x.toFixed(1)} ${dropY.toFixed(1)} ` +
               `C ${termPt.x.toFixed(1)} ${entryY.toFixed(1)} ` +
                 `${cp2x.toFixed(1)} ${entryY.toFixed(1)} ` +
                 `${entryX.toFixed(1)} ${entryY.toFixed(1)} ` +
               `A ${busR} ${busR} 0 ${largeArc} ${sweepFlag} ${arcEndX.toFixed(1)} ${arcEndY.toFixed(1)} ` +
               `L ${slotPt.x.toFixed(1)} ${slotPt.y.toFixed(1)}`;
      }

      // --- 화살표 마커 (곡선 중앙) ---
      function addMidArrow(group, p0, p1, p2, p3, phase, isCubic) {
        let mx, my, dx, dy;
        if (isCubic) {
          mx = 0.125*p0.x + 0.375*p1.x + 0.375*p2.x + 0.125*p3.x;
          my = 0.125*p0.y + 0.375*p1.y + 0.375*p2.y + 0.125*p3.y;
          dx = 0.75*(p2.x + p3.x - p0.x - p1.x);
          dy = 0.75*(p2.y + p3.y - p0.y - p1.y);
        } else {
          // Quadratic midpoint
          const t = 0.5;
          mx = (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x;
          my = (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y;
          dx = 2*(1-t)*(p1.x - p0.x) + 2*t*(p2.x - p1.x);
          dy = 2*(1-t)*(p1.y - p0.y) + 2*t*(p2.y - p1.y);
        }
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const arrow = document.createElementNS(ns, 'path');
        arrow.setAttribute('d', 'M -10 -6 L 10 0 L -10 6 Z');
        arrow.setAttribute('stroke', '#0a1828');
        arrow.setAttribute('stroke-width', '0.8');
        arrow.setAttribute('fill', phaseColors[phase]);
        arrow.setAttribute('opacity', '0.9');
        arrow.setAttribute('transform', `translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${ang.toFixed(1)})`);
        group.appendChild(arrow);
      }

      // ===== 렌더링 시작 =====
      const connectGroup = document.createElementNS(ns, 'g');
      connectGroup.setAttribute('id', 'windingArcs');

      const baseR = outerR + 40;

      // v3.1: 코일 페어 호 (보어, 메인 연결) + 점퍼 호 (보어, 옅은 부가)
      ['U', 'V', 'W'].forEach((phase, phIdx) => {
        const cls = `wire-${phase.toLowerCase()}`;
        const branches = WINDING_MAP[phase];
        if (!branches) return;
        branches.forEach(br => {
          br.coils.forEach((pair, cIdx) => {
            // 1) 코일 페어 — makeWire 우회, 직접 path 생성 (애니메이션 없음)
            const coil = makeCoilPairArc(pair[0], pair[1], phase, phIdx);
            if (coil) {
              const cWire = document.createElementNS(ns, 'path');
              cWire.setAttribute('d', coil.d);
              cWire.setAttribute('fill', 'none');
              cWire.setAttribute('stroke', phaseColors[phase]);
              cWire.setAttribute('stroke-width', '3');
              cWire.setAttribute('stroke-linecap', 'round');
              cWire.setAttribute('opacity', '0.95');
              cWire.setAttribute('class', 'coil-arc');
              connectGroup.appendChild(cWire);
            }
            // 2) 점퍼 — 분기 내 코일 간 연결 (있을 때만)
            if (cIdx < br.coils.length - 1) {
              const nextPair = br.coils[cIdx + 1];
              const jumper = makeJumperArc(pair[1], nextPair[0], phase, phIdx);
              if (jumper) {
                const jWire = makeWire(jumper.d, cls, 'jumper-curve', 800);
                jWire.setAttribute('stroke-width', '1.6');
                jWire.setAttribute('opacity', '0.28');
                jWire.setAttribute('stroke-dasharray', '4 4');
                connectGroup.appendChild(jWire);
              }
            }
          });
        });
      });
      svg.appendChild(connectGroup);

      // ===== (C) 델타 결선 단자 =====
      // 배선 데이터가 있는 경우에만 단자를 그림
      const hasWiring = phaseSlots['U'] && phaseSlots['U'].length > 0;
      if (hasWiring) {
        const termGroup = document.createElementNS(ns, 'g');
        termGroup.setAttribute('id', 'phaseTerminals');

        const phaseSpacing = 110;
        const neutralSpacing = 110;
        const phaseTermY = 80;
        const neutralTermY = svgH - 80;
        const nColor = '#88aadd';

        // UVW: 상단 중앙 클러스터
        const terminals = [
          { name: 'U', x: cx - phaseSpacing, y: phaseTermY, color: '#FF3333' },
          { name: 'V', x: cx,                y: phaseTermY, color: '#4488FF' },
          { name: 'W', x: cx + phaseSpacing, y: phaseTermY, color: '#33DD55' }
        ];

        // N: 하단 중앙 클러스터 (Y 결선만)
        const neutralNodes = [];
        if (conn !== 'Delta') {
          const actualN = Math.max(1, neutralN);
          const startNX = cx - ((actualN - 1) * neutralSpacing) / 2;
          for (let ni = 0; ni < actualN; ni++) {
            neutralNodes.push({
              name: actualN === 1 ? 'N' : `N${ni + 1}`,
              x: startNX + ni * neutralSpacing,
              y: neutralTermY,
              color: nColor
            });
          }
        }

        // --- 터미널 박스 그리기 ---
        function drawTerminal(t) {
          const c = document.createElementNS(ns, 'circle');
          c.setAttribute('cx', t.x); c.setAttribute('cy', t.y);
          c.setAttribute('r', 32);
          c.setAttribute('fill', t.color); c.setAttribute('fill-opacity', '0.15');
          c.setAttribute('stroke', t.color); c.setAttribute('class', 'terminal-node');
          termGroup.appendChild(c);
          const l = document.createElementNS(ns, 'text');
          l.setAttribute('x', t.x); l.setAttribute('y', t.y);
          l.setAttribute('class', 'terminal-label'); l.setAttribute('fill', t.color);
          l.textContent = t.name;
          termGroup.appendChild(l);
        }
        terminals.forEach(drawTerminal);
        neutralNodes.forEach(drawTerminal);

        // --- 라우팅 ---
        if (conn === 'Delta') {
          // Δ: U→V, V→W, W→U
          const deltaMap = [
            { phase: 'U', startTerm: 0, endTerm: 1 },
            { phase: 'V', startTerm: 1, endTerm: 2 },
            { phase: 'W', startTerm: 2, endTerm: 0 }
          ];
          deltaMap.forEach(dm => {
            const pairs = phaseSlots[dm.phase];
            if (!pairs || pairs.length === 0) return;
            const firstSlot = pairs[0][0];
            const lastSlot = pairs[pairs.length - 1][1];
            const busR = phaseBusR[dm.phase];

            // Start: 시작 단자 → 첫 슬롯 (실선)
            const sD = makeTerminalRoute(terminals[dm.startTerm], firstSlot, busR, true);
            if (sD) {
              const sw = makeWire(sD, `wire-${dm.phase.toLowerCase()}`, 'delta-line', 1200);
              sw.setAttribute('opacity', '0.85');
              sw.setAttribute('stroke-width', '2.5');
              termGroup.appendChild(sw);
            }
            // End: 마지막 슬롯 → 다음 상 단자 (점선)
            const eD = makeTerminalRoute(terminals[dm.endTerm], lastSlot, busR, true);
            if (eD) {
              const ew = makeWire(eD, `wire-${dm.phase.toLowerCase()}`, 'delta-line', 1200);
              ew.setAttribute('opacity', '0.55');
              ew.setAttribute('stroke-dasharray', '8 6');
              ew.setAttribute('stroke-width', '2.2');
              termGroup.appendChild(ew);
            }
          });
        } else {
          // Y 결선 — 상별 분기점 노드 도입 (a > 1일 때)
          const junctionY = phaseTermY + 90;
          const junctionR = 16;

          ['U', 'V', 'W'].forEach((phase, phIdx) => {
            const branches = WINDING_MAP[phase];
            if (!branches) return;
            const term = terminals[phIdx];
            const busR = phaseBusR[phase];
            const useJunction = branches.length > 1;
            const startPt = useJunction
              ? { x: term.x, y: junctionY + junctionR }
              : { x: term.x, y: term.y + 32 };

            if (useJunction) {
              // 단자 → 분기점 굵은 와이어
              const tj = document.createElementNS(ns, 'line');
              tj.setAttribute('x1', term.x); tj.setAttribute('y1', term.y + 32);
              tj.setAttribute('x2', term.x); tj.setAttribute('y2', junctionY - junctionR);
              tj.setAttribute('stroke', term.color);
              tj.setAttribute('stroke-width', '3.2');
              tj.setAttribute('stroke-opacity', '0.9');
              termGroup.appendChild(tj);
              // 분기점 노드
              const jc = document.createElementNS(ns, 'circle');
              jc.setAttribute('cx', term.x); jc.setAttribute('cy', junctionY);
              jc.setAttribute('r', junctionR);
              jc.setAttribute('fill', '#0a1828');
              jc.setAttribute('stroke', term.color);
              jc.setAttribute('stroke-width', '2');
              termGroup.appendChild(jc);
              const jl = document.createElementNS(ns, 'text');
              jl.setAttribute('x', term.x); jl.setAttribute('y', junctionY);
              jl.setAttribute('text-anchor', 'middle');
              jl.setAttribute('dominant-baseline', 'central');
              jl.setAttribute('fill', term.color);
              jl.setAttribute('font-size', '11');
              jl.setAttribute('font-weight', '600');
              jl.textContent = `a=${branches.length}`;
              termGroup.appendChild(jl);
            }

            branches.forEach((br, brIdx) => {
              if (br.coils.length === 0) return;
              const firstSlot = br.coils[0][0];
              const lastSlot  = br.coils[br.coils.length - 1][1];

              // Start: 분기점(or 단자) → 분기 첫 슬롯 (⊗ 반쪽으로)
              const goPt = getSlotConnectPt(firstSlot, phase, 'go', slotR + slotH * 0.35);
              const sD = makeTerminalRoute(startPt, firstSlot, busR, true, goPt);
              if (sD) {
                const sw = makeWire(sD, `wire-${phase.toLowerCase()}`, 'delta-line', 1200);
                sw.setAttribute('opacity', '0.85');
                sw.setAttribute('stroke-width', useJunction ? '2' : '2.5');
                termGroup.appendChild(sw);
              }

              // End: 분기 마지막 슬롯 → 지정 N 노드 (⊙ 반쪽에서)
              const nIdx = br.neutralIdx >= 0 ? br.neutralIdx : 0;
              const nd = neutralNodes[Math.min(nIdx, neutralNodes.length - 1)];
              if (nd) {
                const retPt = getSlotConnectPt(lastSlot, phase, 'return', slotR + slotH * 0.35);
                const eD = makeTerminalRoute(nd, lastSlot, neutralBusR, false, retPt);
                if (eD) {
                  const ew = makeWire(eD, `wire-${phase.toLowerCase()}`, 'delta-line', 1200);
                  ew.setAttribute('opacity', '0.6');
                  ew.setAttribute('stroke-dasharray', '8 6');
                  ew.setAttribute('stroke-width', '2');
                  ew.style.stroke = neutralWireColor;
                  termGroup.appendChild(ew);
                }
              }

              // Start/End 라벨 — 철심 바깥, outline 처리, N 번호 포함
              const labelR = outerR + 12;
              const offsetAng = 0.08;
              const sAng = slotAngle(firstSlot) - offsetAng;
              const eAng = slotAngle(lastSlot) + offsetAng;

              const sLbl = document.createElementNS(ns, 'text');
              sLbl.setAttribute('x', cx + labelR * Math.cos(sAng));
              sLbl.setAttribute('y', cy + labelR * Math.sin(sAng));
              sLbl.setAttribute('text-anchor', 'middle');
              sLbl.setAttribute('dominant-baseline', 'central');
              sLbl.setAttribute('fill', term.color);
              sLbl.setAttribute('stroke', '#0a1828');
              sLbl.setAttribute('stroke-width', '3');
              sLbl.setAttribute('paint-order', 'stroke');
              sLbl.setAttribute('font-size', '15');
              sLbl.setAttribute('font-weight', '700');
              sLbl.textContent = `${phase}${brIdx + 1}`;
              termGroup.appendChild(sLbl);

              const eLbl = document.createElementNS(ns, 'text');
              eLbl.setAttribute('x', cx + labelR * Math.cos(eAng));
              eLbl.setAttribute('y', cy + labelR * Math.sin(eAng));
              eLbl.setAttribute('text-anchor', 'middle');
              eLbl.setAttribute('dominant-baseline', 'central');
              eLbl.setAttribute('fill', neutralWireColor);
              eLbl.setAttribute('stroke', '#0a1828');
              eLbl.setAttribute('stroke-width', '3');
              eLbl.setAttribute('paint-order', 'stroke');
              eLbl.setAttribute('font-size', '15');
              eLbl.setAttribute('font-weight', '700');
              eLbl.textContent = `${phase}${brIdx + 1}→${nIdx + 1}`;
              termGroup.appendChild(eLbl);
            });
          });
        }

        svg.appendChild(termGroup);
      }

      // --- 다이어그램 카드 조립 ---
      const diagramArea = document.getElementById('diagramArea');
      diagramArea.innerHTML = `
        <section class="card" style="animation-delay:0.4s">
          <div class="card-title">
            <span class="icon">🔧</span>
            고정자 결선도 (Stator Winding Diagram)
          </div>
          <div class="svg-wrap" id="svgContainer"></div>
          <div class="legend-wrap">
            <div class="legend-item">
              <div class="legend-swatch" style="background:#FF3333"></div>
              Phase U
            </div>
            <div class="legend-item">
              <div class="legend-swatch" style="background:#4488FF"></div>
              Phase V
            </div>
            <div class="legend-item">
              <div class="legend-swatch" style="background:#33DD55"></div>
              Phase W
            </div>
            <div class="legend-item" style="gap:4px">
              <span style="font-size:1rem;color:#fff">↑</span>
              Go (외향 — 전류 진출)
            </div>
            <div class="legend-item" style="gap:4px">
              <span style="font-size:1rem;color:#fff">↓</span>
              Return (내향 — 전류 진입)
            </div>
            <div class="legend-item">
              <div class="legend-swatch" style="background:transparent;border:1.5px dashed #8a9bb5"></div>
              점퍼 와이어 (직렬)
            </div>
          </div>
        </section>`;

      document.getElementById('svgContainer').appendChild(svg);
      diagramArea.classList.remove('hidden');
    }

    /**
     * drawDevelopedDiagram() — Orthogonal Routing
     * 직각 라우팅 기반 전개 결선도.
     */
        /**
     * drawDevelopedDiagram() — Smooth Segment-based Routing
     * 슬롯을 명확한 사각형(세그먼트)으로 표현하고, 바닥으로 뻗는 부드러운 코일 연결을 적용.
     */
    function drawDevelopedDiagram(totalSlots, slotData, phaseSlots, poles, conn, WINDING_MAP, parallelA, neutralN) {
      const ns = 'http://www.w3.org/2000/svg';
      const phaseColors = { U: '#FF3333', V: '#4488FF', W: '#33DD55' };

      const slotW = totalSlots <= 12 ? 40 : totalSlots <= 24 ? 26 : 18;
      const slotGap = totalSlots <= 12 ? 30 : totalSlots <= 24 ? 18 : 10;
      const slotH = totalSlots <= 12 ? 140 : totalSlots <= 24 ? 90 : 70;
      const pitch = slotW + slotGap;
      const padL = totalSlots <= 12 ? 70 : 50;
      const padR = padL;

      const svgW = padL + totalSlots * pitch + padR;

      const busY = { W: 30, V: 50, U: 70, N: 90 };
      const mkCY = busY.N + 30;
      const slotTop = mkCY + 20;
      const slotBot = slotTop + slotH;

      const maxSpan = totalSlots / poles * 1.5;
      const maxCurveDepth = (maxSpan * pitch) * 0.4;
      const svgH = slotBot + Math.max(90, maxCurveDepth + 40);

      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
      svg.setAttribute('width', '100%'); svg.setAttribute('height', 'auto');

      function sCx(s) { return padL + (s-1)*pitch + slotW/2; }
      const mo = slotW * 0.35; 
      function mX(s, side) { return sCx(s) + (side==='left' ? -mo : mo); }
      function fSide(sn, ph, dir) {
        const sd = slotData[sn]; if (!sd) return 'left';
        if (sd.left&&sd.left.phase===ph&&sd.left.dir===dir) return 'left';
        if (sd.right&&sd.right.phase===ph&&sd.right.dir===dir) return 'right';
        if (sd.left&&sd.left.dir===dir) return 'left';
        if (sd.right&&sd.right.dir===dir) return 'right';
        return 'left';
      }

      ['W', 'V', 'U'].forEach(ph => {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', padL - 30); line.setAttribute('y1', busY[ph]);
        line.setAttribute('x2', svgW - padL + 30); line.setAttribute('y2', busY[ph]);
        line.setAttribute('stroke', phaseColors[ph]); line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);

        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', padL - 40); lbl.setAttribute('y', busY[ph]);
        lbl.setAttribute('fill', phaseColors[ph]);
        lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('dominant-baseline', 'central');
        lbl.setAttribute('font-weight', '800'); lbl.setAttribute('font-size', '14');
        lbl.setAttribute('font-family', 'var(--font)');
        lbl.textContent = ph;
        svg.appendChild(lbl);
      });

      if (conn === 'Y') {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', padL - 30); line.setAttribute('y1', busY.N);
        line.setAttribute('x2', svgW - padL + 30); line.setAttribute('y2', busY.N);
        line.setAttribute('stroke', '#88aadd'); line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', '8 6');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);

        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', padL - 40); lbl.setAttribute('y', busY.N);
        lbl.setAttribute('fill', '#88aadd');
        lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('dominant-baseline', 'central');
        lbl.setAttribute('font-weight', '800'); lbl.setAttribute('font-size', '14');
        lbl.setAttribute('font-family', 'var(--font)');
        lbl.textContent = 'N';
        svg.appendChild(lbl);
      }

      for (let s=1; s<=totalSlots; s++) {
        const cx=sCx(s);
        const r=document.createElementNS(ns,'rect');
        r.setAttribute('x',cx-slotW/2); r.setAttribute('y',slotTop);
        r.setAttribute('width',slotW); r.setAttribute('height',slotH);
        r.setAttribute('fill','#223a54'); 
        r.setAttribute('stroke','#4a6a80'); r.setAttribute('stroke-width','2');
        svg.appendChild(r);

        const t=document.createElementNS(ns,'text');
        t.setAttribute('x',cx); t.setAttribute('y',slotTop+slotH/2);
        t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','central');
        t.setAttribute('fill','#fff'); t.setAttribute('font-size', totalSlots <= 12 ? '18' : '12');
        t.setAttribute('font-weight','700'); t.setAttribute('font-family','var(--font)');
        t.textContent=s; svg.appendChild(t);
      }

      function drawMk(cx,cy,dir,color) {
        const mkR = totalSlots <= 12 ? 8 : 6;
        const bg = document.createElementNS(ns,'circle');
        bg.setAttribute('cx',cx); bg.setAttribute('cy',cy); bg.setAttribute('r',mkR);
        bg.setAttribute('fill','#1e293b');
        bg.setAttribute('stroke',color); bg.setAttribute('stroke-width','2');
        svg.appendChild(bg);
        
        if (dir==='go') {
          const sr = mkR * 0.6;
          [[-sr,-sr,sr,sr],[-sr,sr,sr,-sr]].forEach(([x1,y1,x2,y2])=>{
            const ln=document.createElementNS(ns,'line');
            ln.setAttribute('x1',cx+x1); ln.setAttribute('y1',cy+y1);
            ln.setAttribute('x2',cx+x2); ln.setAttribute('y2',cy+y2);
            ln.setAttribute('stroke',color); ln.setAttribute('stroke-width','2');
            ln.setAttribute('stroke-linecap','round'); svg.appendChild(ln);
          });
        } else {
          const d=document.createElementNS(ns,'circle');
          d.setAttribute('cx',cx); d.setAttribute('cy',cy);
          d.setAttribute('r',mkR*0.4); d.setAttribute('fill',color); svg.appendChild(d);
        }
      }

      const wG = document.createElementNS(ns,'g');
      let aD = 0;

      function createWire(d, col, w, dash, op, animate=true) {
        const p=document.createElementNS(ns,'path');
        p.setAttribute('d',d); p.setAttribute('fill','none');
        p.setAttribute('stroke',col); p.setAttribute('stroke-width',w);
        p.setAttribute('stroke-linejoin','round'); p.setAttribute('stroke-linecap','round');
        p.setAttribute('opacity',op||'0.85');
        if (dash) p.setAttribute('stroke-dasharray',dash);
        if (animate) {
          p.style.strokeDasharray='2000'; p.style.strokeDashoffset='2000';
          p.style.setProperty('--dash-len','2000');
          p.classList.add('animated-wire'); p.style.animationDelay=`${aD}s`;
          aD+=0.05;
        }
        wG.appendChild(p);
      }

      function createNode(x, y, col) {
        const c=document.createElementNS(ns,'circle');
        c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r','4.5');
        c.setAttribute('fill',col); svg.appendChild(c);
      }

      const wCoil = totalSlots <= 12 ? '2.5' : '1.8';
      const wTerm = totalSlots <= 12 ? '2.5' : '1.8';

      ['U','V','W'].forEach(phase => {
        const col=phaseColors[phase], brs=WINDING_MAP[phase];
        if (!brs) return;
        
        brs.forEach((br, brIdx) => {
          br.coils.forEach((pair, cIdx) => {
            const gs=pair[0], rs=pair[1];
            const gSide=fSide(gs, phase, 'go');
            const rSide=fSide(rs, phase, 'return');
            const gx=mX(gs, gSide);
            const rx=mX(rs, rSide);

            createWire(`M ${gx} ${mkCY+10} L ${gx} ${slotBot+10}`, col, wCoil, null, '0.8', false);
            createWire(`M ${rx} ${mkCY+10} L ${rx} ${slotBot+10}`, col, wCoil, null, '0.8', false);

            drawMk(gx, mkCY, 'go', col);
            drawMk(rx, mkCY, 'return', col);

            const botY = slotBot + 10;
            const dist = Math.abs(rx - gx);
            const depth = dist * 0.35 + (brIdx * 6);
            createWire(`M ${gx} ${botY} C ${gx} ${botY+depth}, ${rx} ${botY+depth}, ${rx} ${botY}`, col, wCoil, null, '0.85');

            if (cIdx === 0) {
              const by = busY[phase];
              createWire(`M ${gx} ${mkCY-10} L ${gx} ${by}`, col, wTerm, null, '0.9');
              createNode(gx, by, col);
            }

            if (cIdx === br.coils.length - 1) {
              if (conn === 'Y') {
                createWire(`M ${rx} ${mkCY-10} L ${rx} ${busY.N}`, '#88aadd', wTerm, '6 4', '0.7');
                createNode(rx, busY.N, '#88aadd');
              } else {
                const nextPh = phase === 'U' ? 'V' : (phase === 'V' ? 'W' : 'U');
                const by = busY[nextPh];
                createWire(`M ${rx} ${mkCY-10} L ${rx} ${by}`, phaseColors[nextPh], wTerm, '6 4', '0.7');
                createNode(rx, by, phaseColors[nextPh]);
              }
            } else {
              const nxPair = br.coils[cIdx+1];
              const nxgx = mX(nxPair[0], fSide(nxPair[0], phase, 'go'));
              const topY = mkCY - 10;
              const jDepth = Math.abs(nxgx - rx) * 0.2 + 20;
              createWire(`M ${rx} ${topY} C ${rx} ${topY-jDepth}, ${nxgx} ${topY-jDepth}, ${nxgx} ${topY}`, col, wTerm, '5 4', '0.7');
            }
          });
        });
      });
      
      svg.appendChild(wG);
      
      const devArea = document.getElementById('developedDiagramArea');
      devArea.innerHTML = `
        <section class="card" style="animation-delay:0.45s">
          <div class="card-title"><span class="icon">📐</span> 전개 결선도 (Developed Winding Diagram)</div>
          <div class="svg-wrap" id="devSvgContainer" style="overflow-x:auto;"></div>
          <div class="legend-wrap">
            <div class="legend-item"><div class="legend-swatch" style="background:#FF3333"></div>Phase U</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#4488FF"></div>Phase V</div>
            <div class="legend-item"><div class="legend-swatch" style="background:#33DD55"></div>Phase W</div>
            <div class="legend-item" style="gap:4px"><span style="color:#8aa4b8">━━</span> 코일</div>
            <div class="legend-item" style="gap:4px"><span style="color:#8aa4b8">╌╌</span> 점퍼</div>
          </div>
        </section>`;
      document.getElementById('devSvgContainer').appendChild(svg);
    }


    /**
     * =====================================================
     * drawDeltaSchematic(phaseSlots)
     * =====================================================
     * 정삼각형 형태의 델타(Δ) 결선 회로도를 SVG로 그립니다.
     *
     * [델타 결선 원리]
     * - U단자: Phase U의 Start + Phase W의 End
     * - V단자: Phase V의 Start + Phase U의 End
     * - W단자: Phase W의 Start + Phase V의 End
     * - 각 변(U→V, V→W, W→U)에 코일(인덕터) 기호를 배치
     */
    function drawDeltaSchematic(phaseSlots) {
      const ns = 'http://www.w3.org/2000/svg';
      const W = 540, H = 520;

      // 정삼각형 꼭짓점 (상단 중앙, 좌하, 우하)
      const triCx = W / 2, triCy = H / 2 + 10;
      const triR = 170;  // 삼각형 외접원 반지름
      // 꼭짓점: U(상단), W(좌하), V(우하)
      // 델타에서는 U-V 변 = Phase U, V-W 변 = Phase V, W-U 변 = Phase W
      const nodes = {
        U: { x: triCx, y: triCy - triR, color: '#FF3333' },
        V: { x: triCx + triR * Math.cos(-Math.PI/6), y: triCy + triR * Math.sin(-Math.PI/6) * -1 + triR, color: '#4488FF' },
        W: { x: triCx - triR * Math.cos(-Math.PI/6), y: triCy + triR * Math.sin(-Math.PI/6) * -1 + triR, color: '#33DD55' }
      };
      // 좌표 보정 — 깔끔한 정삼각형
      const h = triR * 1.5;
      nodes.U = { x: triCx, y: 90, color: '#FF3333' };
      nodes.V = { x: triCx + h * 0.87, y: 90 + h * 1.5, color: '#4488FF' };
      nodes.W = { x: triCx - h * 0.87, y: 90 + h * 1.5, color: '#33DD55' };

      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.style.maxWidth = '100%'; svg.style.height = 'auto';

      // --- 헬퍼: 인덕터(코일) 기호 path 생성 ---
      // from→to 직선 위에 사인파 형태의 코일 기호를 그림
      function coilPath(x1, y1, x2, y2, nLoops) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const ux = dx/len, uy = dy/len;       // 단위 벡터 (방향)
        const nx = -uy, ny = ux;               // 법선 벡터 (수직)

        // 코일은 전체 길이의 중간 60%를 차지
        const coilStart = 0.2, coilEnd = 0.8;
        const coilLen = (coilEnd - coilStart) * len;
        const loopW = coilLen / nLoops;
        const amp = 10;  // 코일 진폭

        // 시작 직선
        const sx = x1 + ux * len * coilStart;
        const sy = y1 + uy * len * coilStart;
        let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${sx.toFixed(1)} ${sy.toFixed(1)}`;

        // 반원 코일 루프
        for (let i = 0; i < nLoops; i++) {
          const cx1 = sx + ux * (i * loopW + loopW * 0.25) + nx * amp;
          const cy1 = sy + uy * (i * loopW + loopW * 0.25) + ny * amp;
          const ex = sx + ux * (i * loopW + loopW * 0.5);
          const ey = sy + uy * (i * loopW + loopW * 0.5);
          const cx2 = sx + ux * (i * loopW + loopW * 0.75) - nx * amp;
          const cy2 = sy + uy * (i * loopW + loopW * 0.75) - ny * amp;
          const endX = sx + ux * ((i + 1) * loopW);
          const endY = sy + uy * ((i + 1) * loopW);
          d += ` Q ${cx1.toFixed(1)} ${cy1.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
          d += ` Q ${cx2.toFixed(1)} ${cy2.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
        }

        // 끝 직선
        d += ` L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        return d;
      }

      // --- 삼각형 각 변 = 각 상의 코일 ---
      // 델타 결선 배치:
      //   U → V 변: Phase U (Start U → End U)
      //   V → W 변: Phase V (Start V → End V)
      //   W → U 변: Phase W (Start W → End W)
      const sides = [
        { from: 'U', to: 'V', phase: 'U', color: '#FF3333' },
        { from: 'V', to: 'W', phase: 'V', color: '#4488FF' },
        { from: 'W', to: 'U', phase: 'W', color: '#33DD55' }
      ];

      sides.forEach(side => {
        const f = nodes[side.from], t = nodes[side.to];
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const ux = dx/len, uy = dy/len;
        const nx = uy, ny = -ux;

        const pairs = phaseSlots[side.phase] || [];
        const numCoils = pairs.length;

        if (numCoils === 0) {
          const l = document.createElementNS(ns, 'line');
          l.setAttribute('x1', f.x); l.setAttribute('y1', f.y);
          l.setAttribute('x2', t.x); l.setAttribute('y2', t.y);
          l.setAttribute('stroke', side.color); l.setAttribute('stroke-width', '2.5');
          svg.appendChild(l);
          return;
        }

        const segLen = len / numCoils;

        pairs.forEach((pair, idx) => {
          const segStart = idx * segLen;
          const segEnd = (idx + 1) * segLen;
          
          // 선-코일-선 비율 (30% - 40% - 30%)
          const lLen = segLen * 0.3;
          
          const sx = f.x + ux * segStart;
          const sy = f.y + uy * segStart;
          const ex = f.x + ux * segEnd;
          const ey = f.y + uy * segEnd;
          
          const cx1 = sx + ux * lLen;
          const cy1 = sy + uy * lLen;
          const cx2 = ex - ux * lLen;
          const cy2 = ey - uy * lLen;

          // 진입선
          const l1 = document.createElementNS(ns, 'line');
          l1.setAttribute('x1', sx); l1.setAttribute('y1', sy);
          l1.setAttribute('x2', cx1); l1.setAttribute('y2', cy1);
          l1.setAttribute('stroke', side.color); l1.setAttribute('stroke-width', '2.5');
          l1.setAttribute('stroke-linecap', 'round');
          svg.appendChild(l1);

          // 진출선
          const l2 = document.createElementNS(ns, 'line');
          l2.setAttribute('x1', cx2); l2.setAttribute('y1', cy2);
          l2.setAttribute('x2', ex); l2.setAttribute('y2', ey);
          l2.setAttribute('stroke', side.color); l2.setAttribute('stroke-width', '2.5');
          l2.setAttribute('stroke-linecap', 'round');
          svg.appendChild(l2);

          // 코일 심볼 (지그재그)
          const nLoops = 3;
          const loopW = (segLen * 0.4) / nLoops;
          const amp = 7;
          let d = `M ${cx1.toFixed(1)} ${cy1.toFixed(1)}`;
          for (let i = 0; i < nLoops; i++) {
            const pc1x = cx1 + ux * (i * loopW + loopW * 0.25) + nx * amp;
            const pc1y = cy1 + uy * (i * loopW + loopW * 0.25) + ny * amp;
            const pmidx = cx1 + ux * (i * loopW + loopW * 0.5);
            const pmidy = cy1 + uy * (i * loopW + loopW * 0.5);
            const pc2x = cx1 + ux * (i * loopW + loopW * 0.75) - nx * amp;
            const pc2y = cy1 + uy * (i * loopW + loopW * 0.75) - ny * amp;
            const pendx = cx1 + ux * ((i + 1) * loopW);
            const pendy = cy1 + uy * ((i + 1) * loopW);
            d += ` Q ${pc1x.toFixed(1)} ${pc1y.toFixed(1)} ${pmidx.toFixed(1)} ${pmidy.toFixed(1)}`;
            d += ` Q ${pc2x.toFixed(1)} ${pc2y.toFixed(1)} ${pendx.toFixed(1)} ${pendy.toFixed(1)}`;
          }
          const cp = document.createElementNS(ns, 'path');
          cp.setAttribute('d', d); cp.setAttribute('fill', 'none');
          cp.setAttribute('stroke', side.color); cp.setAttribute('stroke-width', '2.5');
          cp.setAttribute('stroke-linecap', 'round');
          svg.appendChild(cp);

          // 라벨 표기 (바깥쪽으로 16px 오프셋)
          // 지그재그를 그릴 때 라벨이 겹치지 않도록 높이를 조절
          const midX = (sx + ex) / 2;
          const midY = (sy + ey) / 2;
          // 번갈아가며 살짝 엇갈리게 배치하여 텍스트 겹침 완화
          const isEven = idx % 2 === 0;
          const offDist = isEven ? 18 : 28; 
          const offX = nx * offDist;
          const offY = ny * offDist;
          
          const lbl = document.createElementNS(ns, 'text');
          lbl.setAttribute('x', midX + offX);
          lbl.setAttribute('y', midY + offY);
          lbl.setAttribute('text-anchor', 'middle');
          lbl.setAttribute('dominant-baseline', 'central');
          lbl.setAttribute('fill', side.color);
          lbl.setAttribute('font-size', numCoils > 12 ? '9' : '11');
          lbl.setAttribute('font-weight', '700');
          lbl.setAttribute('opacity', '0.9');
          lbl.setAttribute('font-family', 'var(--font)');
          lbl.textContent = pair.join('-');
          svg.appendChild(lbl);

          // 방향 화살표 (마지막 코일의 끝단 근처)
          if (idx === numCoils - 1) {
            const aPt = 0.9;
            const ax = sx + (ex - sx) * aPt;
            const ay = sy + (ey - sy) * aPt;
            const angle = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
            const arrowG = document.createElementNS(ns, 'g');
            arrowG.setAttribute('transform', `translate(${ax},${ay}) rotate(${angle})`);
            const arrowPath = document.createElementNS(ns, 'path');
            arrowPath.setAttribute('d', 'M -6 -4 L 2 0 L -6 4');
            arrowPath.setAttribute('stroke', side.color);
            arrowPath.setAttribute('stroke-width', '2.5');
            arrowPath.setAttribute('fill', 'none');
            arrowPath.setAttribute('stroke-linecap', 'round');
            arrowG.appendChild(arrowPath);
            svg.appendChild(arrowG);
          }
        });
      });

      // --- 꼭짓점 단자 노드 ---
      // 각 꼭짓점에서 만나는 상:
      //   U: Phase U Start + Phase W End
      //   V: Phase V Start + Phase U End
      //   W: Phase W Start + Phase V End
      const nodeInfo = {
        U: 'Start U / End W',
        V: 'Start V / End U',
        W: 'Start W / End V'
      };

      ['U', 'V', 'W'].forEach(name => {
        const n = nodes[name];
        // 원
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', n.x); c.setAttribute('cy', n.y);
        c.setAttribute('r', 22);
        c.setAttribute('fill', n.color); c.setAttribute('fill-opacity', '0.15');
        c.setAttribute('stroke', n.color); c.setAttribute('stroke-width', '2.5');
        svg.appendChild(c);

        // 단자명 오프셋
        let tx = n.x, ty = n.y;
        if (name === 'U') {
          ty -= 38;
        } else if (name === 'V') {
          tx += 34;
          ty += 28;
        } else if (name === 'W') {
          tx -= 34;
          ty += 28;
        }

        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', tx); t.setAttribute('y', ty);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'central');
        t.setAttribute('fill', n.color);
        t.setAttribute('font-size', '16'); t.setAttribute('font-weight', '800');
        t.setAttribute('font-family', 'var(--font)');
        t.textContent = name;
        svg.appendChild(t);
      });

      // --- 타이틀 ---
      const title = document.createElementNS(ns, 'text');
      title.setAttribute('x', W / 2); title.setAttribute('y', 28);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('fill', '#5a6f8a');
      title.setAttribute('font-size', '12');
      title.setAttribute('font-family', 'var(--font)');
      title.textContent = 'Delta (Δ) Connection Schematic';
      svg.appendChild(title);

      // --- 카드에 조립 ---
      const area = document.getElementById('deltaSchematicArea');
      area.innerHTML = `
        <section class="card" style="animation-delay:0.5s">
          <div class="card-title">
            <span class="icon">⚡</span>
            델타(Δ) 결선 도식 (Delta Connection Schematic)
          </div>
          <div class="svg-wrap" id="deltaContainer"></div>
        </section>`;
      document.getElementById('deltaContainer').appendChild(svg);
      area.classList.remove('hidden');
    }