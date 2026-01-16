import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { usePrivy } from '@privy-io/react-auth';

interface Task {
  id: number;
  text: string;
  completed: boolean;
  hasBlocker: boolean;
}

export function usePersistentTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const { authenticated, ready, user } = usePrivy();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (authenticated) {
      loadTasks();
    } else {
      setLoading(false);
      setTasks([]);
    }
  }, [authenticated, ready]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const userId = user?.id || 'anonymous';
      const data = await api.getTasks(userId);
      
      const formattedTasks = data.map((t: any) => ({
        id: Number(t.id),
        text: t.title,
        completed: t.completed,
        hasBlocker: false,
      }));
      setTasks(formattedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (text: string) => {
    if (!authenticated) {
      const newTask: Task = {
        id: Date.now(),
        text,
        completed: false,
        hasBlocker: false,
      };
      setTasks([...tasks, newTask]);
      return newTask;
    }

    try {
      const userId = user?.id || 'anonymous';
      
      const newTask = await api.createTask({
        userId,
        title: text,
        description: '',
        priority: 'medium'
      });
      
      const formattedTask: Task = {
        id: Number(newTask.id),
        text: newTask.title,
        completed: newTask.completed,
        hasBlocker: false,
      };
      setTasks([...tasks, formattedTask]);
      return formattedTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };

  const updateTask = async (id: number, updates: Partial<Task>) => {
    if (!authenticated) {
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
      return;
    }

    try {
      const userId = user?.id || 'anonymous';
      
      const backendUpdates: any = { userId };
      if (updates.text !== undefined) backendUpdates.title = updates.text;
      if (updates.completed !== undefined) backendUpdates.completed = updates.completed;

      const updated = await api.updateTask(id.toString(), backendUpdates);

      const formattedTask: Task = {
        id: Number(updated.id),
        text: updated.title,
        completed: updated.completed,
        hasBlocker: updates.hasBlocker || false,
      };
      setTasks(tasks.map(t => t.id === id ? formattedTask : t));
      return formattedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  };

  const deleteTask = async (id: number) => {
    if (!authenticated) {
      setTasks(tasks.filter(t => t.id !== id));
      return;
    }

    try {
      await api.deleteTask(id.toString());
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  return {
    tasks,
    setTasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refreshTasks: loadTasks,
  };
}

export function useAutoSaveSession(
  tasks: Task[],
  energy: number,
  focusSeconds: number,
  uptime: number,
  lastBreak: number | null,
) {
  const api = useApi();
  const { authenticated } = usePrivy();

  useEffect(() => {
    if (!authenticated || tasks.length === 0) return;

    const interval = setInterval(async () => {
      try {
        await api.saveSession({
          uptime_score: uptime,
          energy_level: energy,
          focus_minutes: Math.floor(focusSeconds / 60),
          tasks: tasks.map(t => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            hasBlocker: t.hasBlocker,
          })),
          had_break: !!lastBreak,
        });
        console.log('✅ Session auto-saved to backend');
      } catch (error) {
        console.error('Failed to auto-save session:', error);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authenticated, tasks, energy, focusSeconds, uptime, lastBreak, api]);
}

export function useHistoricalData() {
  const [history, setHistory] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const { authenticated } = usePrivy();

  const loadHistory = useCallback(async (days: number = 7) => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getHistory(days);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, [authenticated, api]);

  const loadWeeklyStats = useCallback(async () => {
    if (!authenticated) return;

    try {
      const stats = await api.getWeeklyStats();
      setWeeklyStats(stats);
    } catch (error) {
      console.error('Failed to load weekly stats:', error);
    }
  }, [authenticated, api]);

  useEffect(() => {
    if (authenticated) {
      loadHistory();
      loadWeeklyStats();
    }
  }, [authenticated, loadHistory, loadWeeklyStats]);

  return {
    history,
    weeklyStats,
    loading,
    loadHistory,
    loadWeeklyStats,
  };
}