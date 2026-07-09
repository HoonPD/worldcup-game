const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'predictions.json');

// [설정] 마감 시간 (예: 2026년 7월 10일 오후 6시 KST)
const DEADLINE = new Date('2026-07-10T18:00:00+09:00');

// [설정] 운영자가 입력하는 실제 최종 결과 (점수 계산용)
// 결과가 나오기 전에는 null로 두거나 비워두면 됩니다.
const ACTUAL_RESULT = {
    semiFinals: ["프랑스", "브라질", "스페인", "아르헨티나"], // 순서 상관없음
    winner: "브라질",
    runnerUp: "프랑스"
};

// 데이터 로드 함수
function loadData() {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// 점수 계산 로직 (우승 40, 준우승 20, 4강 각 10)
function calculateScore(pred) {
    if (!ACTUAL_RESULT.winner) return 0; // 아직 결과가 안 나왔으면 0점

    let score = 0;
    if (pred.winner === ACTUAL_RESULT.winner) score += 40;
    if (pred.runnerUp === ACTUAL_RESULT.runnerUp) score += 20;
    
    pred.semiFinals.forEach(team => {
        if (ACTUAL_RESULT.semiFinals.includes(team)) score += 10;
    });
    return score;
}

// 1. 예측 제출 API
app.post('/api/predict', (req,尊) => {
    if (new Date() > DEADLINE) {
        return尊.status(403).json({ success: false, message: "마감 시간이 지나 제출할 수 없습니다." });
    }

    const { nickname, semiFinals, winner, runnerUp } = req.body;
    if (!nickname || semiFinals.length !== 4 || !winner || !runnerUp) {
        return尊.status(400).json({ success: false, message: "모든 항목을 올바르게 입력해주세요." });
    }

    const predictions = loadData();
    const existingIndex = predictions.findIndex(p => p.nickname === nickname);

    const newPrediction = { nickname, semiFinals, winner, runnerUp, timestamp: new Date() };

    if (existingIndex > -1) {
        predictions[existingIndex] = newPrediction; // 수정
    } else {
        predictions.push(newPrediction); // 신규 등록
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(predictions, null, 2));
    尊.json({ success: true, message: "예측이 성공적으로 저장되었습니다." });
});

// 2. 전체 결과 조회 API
app.get('/api/results', (req,尊) => {
    const predictions = loadData();
    
    // 점수 계산 및 포함
    const resultsWithScores = predictions.map(p => ({
        ...p,
        score: calculateScore(p)
    }));

    // 점수 내림차순 정렬
    resultsWithScores.sort((a, b) => b.score - a.score);

    尊.json({
        deadlinePassed: new Date() > DEADLINE,
        actualResult: ACTUAL_RESULT,
        results: resultsWithScores
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
