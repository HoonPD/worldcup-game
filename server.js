const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'predictions.json');

// [설정] 마감 시간: 8강 2경기 시작 시간 (2026년 7월 11일 오전 04:00 KST)
const DEADLINE = new Date('2026-07-11T04:00:00+09:00');

// 🏆 [실시간 경기 결과 입력창] 
// 경기가 끝날 때마다 운영자가 이 배열과 필드를 채워 넣으면 대시보드 점수가 실시간으로 업데이트됩니다!
const ACTUAL_RESULT = {
    semiFinals: ["프랑스"], // 8강 경기 결과에 따라 팀이 확정되면 추가 (예: "스페인", "잉글랜드" 등)
    winner: "",            // 결승 종료 후 최종 우승국 입력 (예: "프랑스")
    runnerUp: ""           // 결승 종료 후 최종 준우승국 입력 (예: "스페인")
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

// 🎯 [새로운 점수 계산 체계 적용]
function calculateScore(pred) {
    let score = 0;
    
    // 1. 4강 진출팀 적중 점수 계산 (각 10점, 최대 40점)
    pred.semiFinals.forEach(team => {
        if (ACTUAL_RESULT.semiFinals.includes(team)) {
            score += 10;
        }
    });

    // 2. 최종 우승팀 적중 점수 계산 (40점)
    if (ACTUAL_RESULT.winner && pred.winner === ACTUAL_RESULT.winner) {
        score += 40;
    }

    // 3. 최종 준우승팀 적중 점수 계산 (30점)
    if (ACTUAL_RESULT.runnerUp && pred.runnerUp === ACTUAL_RESULT.runnerUp) {
        score += 30;
    }
    
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

// 2. 전체 결과 및 실시간 랭킹 조회 API
app.get('/api/results', (req, res) => {
    const predictions = loadData();
    
    // 사용자가 대시보드를 요청하는 순간 최신 ACTUAL_RESULT를 바탕으로 점수를 실시간 재계산
    const resultsWithScores = predictions.map(p => ({
        ...p,
        score: calculateScore(p)
    }));

    // 점수 기준 내림차순 정렬 (동점일 경우 먼저 제출한 유저가 상위 랭크)
    resultsWithScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.timestamp) - new Date(b.timestamp);
    });

    res.json({
        deadlinePassed: new Date() > DEADLINE,
        actualResult: ACTUAL_RESULT,
        results: resultsWithScores
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));