# Changelog

All notable changes to Stuart Speaks TTS Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2024-12-21

### Added
- Hybrid authentication system (Google OAuth + email verification)
- Admin configuration panel with encrypted storage
- Email whitelist management system
- Fish.Audio WebSocket TTS integration
- Smart text chunking for long content
- Audio caching and combination features
- PWA support with offline capabilities
- Real-time autocomplete with phrases and history
- Session-based authentication with file storage
- Interactive setup script for environment configuration

### Fixed
- Configuration encryption bug that corrupted API credentials when saving masked values
- Proper handling of masked configuration display values
- Email whitelist persistence across server restarts
- Admin email protection (cannot be removed from whitelist)

### Security
- AES-256-CBC encryption for sensitive configuration data
- Persistent encryption key generation and storage
- Session security with configurable secrets
- Admin-only access to configuration management

### Changed
- Migrated from JavaScript to TypeScript
- Separated email whitelist from main configuration
- Improved error handling and logging
- Enhanced audio debugging and state management

## [Unreleased]

