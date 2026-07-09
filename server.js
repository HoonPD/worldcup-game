const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'predictions.json');

// [설정] 마감 시간: 8강 첫 경기 시작 시간 (2026년 7월 10일 오전 5시 KST)
const DEADLINE = new Date('2026-07-10T05:00:00+09:00');

// [설정] 운영자가 입력하는 실제 최종 결과 (점수 계산용)
// 월드컵이 완전히 종료된 후 실제 결과를 여기에 채워 넣으시면 점수가 자동으로 계산됩니다.
const ACTUAL_RESULT = {
    semiFinals: ["프랑스", "스페인", "잉글랜드", "아르헨티나"], // 예시 (순서 상관없음)
    winner: "프랑스",                                       // 예시
    runnerUp: "아르헨티나"                                  // 예시
};

function loadData() {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function calculateScore(pred) {
    if (!ACTUAL_RESULT.winner) return 0; // 아직 최종 결과가 안 나왔으면 0점

    let score = 0;
    if (pred.winner === ACTUAL_RESULT.winner) score += 40;
    if (pred.runnerUp === ACTUAL_RESULT.runnerUp) score += 20;
    
    pred.semiFinals.forEach(team => {
        if (ACTUAL_RESULT.semiFinals.includes(team)) score += 10;
    });
    return score;
}

// 1. 예측 제출 API
app.post('/api/predict', (req, res) => {
    if (new Date() > DEADLINE) {
        return res.status(403).json({ success: false, message: "마감 시간이 지나 제출할 수 없습니다." });
    }

    const { nickname, semiFinals, winner, runnerUp } = req.body;
    if (!nickname || semiFinals.length !== 4 || !winner || !runnerUp) {
        return res.status(400).json({ success: false, message: "모든 항목을 올바르게 입력해주세요." });
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
    res.json({ success: true, message: "예측이 성공적으로 저장되었습니다." });
});

// 2. 전체 결과 조회 API
app.get('/api/results', (req, res) => {
    const predictions = loadData();
    
    const resultsWithScores = predictions.map(p => ({
        ...p,
        score: calculateScore(p)
    }));

    // 점수 내림차순 정렬
    resultsWithScores.sort((a, b) => b.score - a.score);

    res.json({
        deadlinePassed: new Date() > DEADLINE,
        actualResult: ACTUAL_RESULT,
        results: resultsWithScores
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
