import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tracker from './Tracker';
import { useAppStore } from '../store';
import { BrowserRouter } from 'react-router-dom';

describe('Tracker Component', () => {
  beforeEach(() => {
    // Setup initial store state so Tracker has something to display
    useAppStore.setState({
      bossProfiles: [{
        id: 'b1',
        name: '绝境战',
        parts: [{
          id: 'p1',
          name: 'P1',
          maxDuration: '',
          mechanics: [{
            id: 'm1',
            shortName: '索尼',
            officialName: '',
            startTime: '',
            endTime: '',
            notes: '',
            errorPoints: [{ id: 'e1', name: '站错位置', isDeleted: false }]
          }]
        }]
      }],
      teams: [{
        id: 't1',
        name: '开荒队',
        bossId: 'b1',
        players: [{
          id: 'player1',
          name: '丝瓜卡夫卡',
          role: 'MT',
          job: 'DRK',
          status: 'on_field'
        }]
      }],
      mistakes: [],
      activeTeamId: 't1'
    });
  });

  it('renders the active boss name and team name', () => {
    render(
      <BrowserRouter>
        <Tracker />
      </BrowserRouter>
    );
    
    // Test that the Boss Name and Team Name from our mock store state are rendered
    expect(screen.getByText('绝境战')).toBeInTheDocument();
    expect(screen.getByText(/当前队伍: 开荒队/)).toBeInTheDocument();
  });

  it('renders parts and mechanics correctly', () => {
    render(
      <BrowserRouter>
        <Tracker />
      </BrowserRouter>
    );
    
    // Check Part name
    expect(screen.getByText('P1')).toBeInTheDocument();
    
    // Simulate clicking on the part to display its mechanics
    fireEvent.click(screen.getByText('P1'));
    
    // Check Mechanic name
    expect(screen.getByText('索尼')).toBeInTheDocument();
  });
});
