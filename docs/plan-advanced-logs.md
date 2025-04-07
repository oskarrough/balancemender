# Enhanced Combat Logging System

## Overview
Create a comprehensive combat logging system inspired by World of Warcraft's combat logs. The system will capture detailed information about gameplay events for both debugging during development and player analytics. It will support opt-in cloud storage with privacy considerations while maintaining a structured, searchable format.

## Goals
- Capture detailed combat data for analysis and debugging
- Enable developers to track bugs and balance issues
- Allow players to analyze their performance
- Create foundation for future features like combat replay and detailed statistics
- Implement an opt-in system for players to contribute logs
- Maintain privacy and data ownership for players

## Log Format
Based on WoW's proven format:
```
[TIMESTAMP] EVENT_TYPE,SourceID,"SourceName",TargetID,"TargetName",SpellID,"SpellName",Value,ExtraInfo,IsAOE,GroupID
```

## Implementation Plan

### Phase 1: Local Logging Infrastructure
- [x] Enhance existing `combatlog.ts` to use structured format
- [x] Create proper `LogEvent` interface with all required fields
- [x] Add timestamp precision to milliseconds
- [ ] Persist logs somewhere?
- [x] Create developer console commands to manipulate logs
- [ ] Implement log rotation to prevent storage overflow

### Phase 2: In-Game Log Viewer
- [x] Create basic log viewer accessible in dev mode
- [x] Add filtering capabilities (by event type, source, target)
- [x] Implement color coding for different event types
- [x] Add search functionality
- [ ] Add session overview with key metrics

### Phase 3: Cloud Storage & Opt-In System
- [ ] Design and implement opt-in UI with clear privacy information
- [ ] Create simple REST API endpoint for log submission
- [ ] Set up SQLite database with optimized schema for log storage
- [ ] Implement session IDs to group related events
- [ ] Add data sanitization for any sensitive information
- [ ] Implement batched writes to reduce API calls
- [ ] Create basic admin interface to view submitted logs

### Phase 4: Analysis Tools
- [ ] Develop metrics dashboard for player performance
- [ ] Add spell usage statistics
- [ ] Create healing/damage done summaries
- [ ] Implement timeline visualization
- [ ] Add combat replay prototype (if feasible)

## Technical Considerations
- Use structured JSON internally but compressed format for transmission
- Implement proper error handling for log submission failures
- Consider rate limiting to prevent excessive logging
- Add versioning to log format for future compatibility
- Use unique session IDs to correlate events without personal identifiers

## Privacy & Data Handling
- No player identification without explicit consent
- Clear opt-in process with explanation of data usage
- Option to delete contributed data
- Anonymous session IDs by default
- Secure transmission of log data (HTTPS)
- Clear data retention policy

## Future Possibilities
- Real-time analytics dashboard
- Performance benchmarking against other players
- Combat replay functionality
- Integration with community sites/tools
- AI analysis of play patterns
- Leaderboards and performance metrics
