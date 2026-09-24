.PHONY: dev test

# Googleアカウント・Cloudflareアカウントなしで動く開発モード(3分で動かす)
dev:
	bash scripts/dev.sh

# worker のユニットテスト + Python の構文チェック
test:
	cd worker && npm test
	python3 -m py_compile poller/poll.py scripts/get_cookies.py scripts/screenshot_phone.py scripts/dev_mock_feed.py
