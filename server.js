const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ⚠️ [중요 변동] Render 권한 에러 방지를 위해 최상위 폴더에 바로 저장하도록 변경
const DATA_FILE = path.join(__dirname, 'predictions.json');

// [설정] 새 마감 시간: 8강 2경기 시작 시간 (2026년 7월 11일 오전 04:00 KST)
const DEADLINE = new Date('2026-07-11T04:00:00+09:00');

// [설정] 실제 경기 결과 반영 (프랑스 4강 진출 확정!)
const ACTUAL_RESULT = {
    semiFinals: ["프랑스"], 
    winner: "",            
    runnerUp: ""           
};

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
            return [];
        }
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        return content ? JSON.parse(content) : [];
    } catch (e) {
        console.error("데이터 로드 실패:", e);
        return [];
    }
}

function calculateScore(pred) {
    let score = 0;
    pred.semiFinals.forEach(team => {
        if (ACTUAL_RESULT.semiFinals.includes(team)) score += 10;
    });
    if (ACTUAL_RESULT.winner && pred.winner === ACTUAL_RESULT.winner) score += 40;
    if (ACTUAL_RESULT.runnerUp && pred.runnerUp === ACTUAL_RESULT.runnerUp) score += 20;
    return score;
}

// 1. 예측 제출 API
app.post('/api/predict', (req, res) => {
    if (new Date() > DEADLINE) {
        return res.status(403).json({ success: false, message: "마감 시간이 지나 제출할 수 없습니다." });
    }

    const { nickname, semiFinals, winner, runnerUp } = req.body;
    if (!nickname || !semiFinals || semiFinals.length !== 4 || !winner || !runnerUp) {
        return res.status(400).json({ success: false, message: "모든 항목을 올바르게 입력해주세요." });
    }

    if (semiFinals[0] !== "프랑스") {
        return res.status(400).json({ success: false, message: "매치 1은 이미 프랑스 승리로 종료되었습니다." });
    }

    try {
        const predictions = loadData();
        const existingIndex = predictions.findIndex(p => p.nickname === nickname);
        const newPrediction = { nickname, semiFinals, winner, runnerUp, timestamp: new Date() };

        if (existingIndex > -1) {
            predictions[existingIndex] = newPrediction;
        } else {
            predictions.push(newPrediction);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(predictions, null, 2));
        res.json({ success: true, message: "남은 경기 예측이 정상적으로 저장되었습니다!" });
    } catch (error) {
        console.error("데이터 저장 실패:", error);
        res.status(500).json({ success: false, message: "서버 내부 저장소 오류가 발생했습니다." });
    }
});

// 2. 전체 결과 조회 API
app.get('/api/results', (req, res) => {
    const predictions = loadData();
    const resultsWithScores = predictions.map(p => ({
        ...p,
        score: calculateScore(p)
    }));

    resultsWithScores.sort((a, b) => b.score - a.score);

    res.json({
        deadlinePassed: new Date() > DEADLINE,
        actualResult: ACTUAL_RESULT,
        results: resultsWithScores
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));