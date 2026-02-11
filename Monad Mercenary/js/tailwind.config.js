tailwind.config = {
    theme: {
        extend: {
            colors: {
                monad: {
                    base: '#000000',
                    card: '#0A0A0A',
                    accent: '#825CFF', // Purple
                    blue: '#00A3FF',  // Blue
                    light: '#A682FF',
                    success: '#00A3FF', // Replaced Green with Blue
                    dim: '#FFFFFF10'
                }
            },
            fontFamily: {
                sans: ['"Space Grotesk"', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'scan': 'scan 4s linear infinite',
                'glitch': 'glitch 1s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                scan: {
                    '0%': { backgroundPosition: '0% 0%' },
                    '100%': { backgroundPosition: '0% 100%' },
                },
                glitch: {
                    '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
                    '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
                    '62%': { transform: 'translate(0,0) skew(5deg)' },
                }
            }
        }
    }
}
