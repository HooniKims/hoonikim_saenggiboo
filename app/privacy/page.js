"use client";

export default function PrivacyPage() {
    return (
        <div className="container py-12" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="hero-section animate-fade-in">
                <h1 className="hero-title">개인정보처리방침</h1>
                <p className="hero-subtitle">
                    생기부 작성 도우미 & 나이스 자동입력 도우미
                </p>
            </div>

            <div className="section-card p-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>
                    1. 개인정보 수집 및 이용
                </h2>
                <p style={{ lineHeight: '1.8', color: '#4b5563', marginBottom: '1.5rem' }}>
                    본 서비스(생기부 작성 도우미 웹앱 및 나이스 자동입력 도우미 크롬 확장 프로그램)는
                    <strong> 사용자의 개인정보를 수집, 저장, 전송하지 않습니다.</strong>
                </p>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>
                    2. 데이터 저장 방식
                </h2>
                <p style={{ lineHeight: '1.8', color: '#4b5563', marginBottom: '1.5rem' }}>
                    모든 데이터는 사용자의 <strong>로컬 브라우저(Local Storage, Chrome Storage)</strong>에만 저장됩니다.
                    외부 서버로 전송되거나 제3자와 공유되지 않습니다.
                </p>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>
                    3. 크롬 확장 프로그램 권한
                </h2>
                <ul style={{ lineHeight: '2', color: '#4b5563', marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                    <li><strong>activeTab:</strong> 현재 탭에서 데이터를 읽고 입력하기 위해 사용</li>
                    <li><strong>scripting:</strong> 나이스(NEIS) 페이지에 자동 입력을 위해 사용</li>
                    <li><strong>storage:</strong> 브라우저 로컬 저장소에 데이터 임시 보관</li>
                </ul>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>
                    4. 제3자 제공
                </h2>
                <p style={{ lineHeight: '1.8', color: '#4b5563', marginBottom: '1.5rem' }}>
                    본 서비스는 사용자 데이터를 제3자에게 판매, 전송, 공유하지 않습니다.
                </p>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>
                    5. 문의
                </h2>
                <p style={{ lineHeight: '1.8', color: '#4b5563' }}>
                    개인정보처리방침에 대한 문의사항은 개발자에게 연락해 주세요.
                </p>

                <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        최종 업데이트: 2024년 12월
                    </p>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <a href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    ← 메인 페이지로 돌아가기
                </a>
            </div>
        </div>
    );
}
