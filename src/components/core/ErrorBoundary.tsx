import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    // Optionally clear some bad state from local storage here if needed
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full bg-red-50/50 rounded-2xl border border-red-100 p-8 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">组件渲染异常</h2>
          <p className="text-gray-500 mb-8 max-w-md">
            该视图模块遇到意外错误导致崩溃。我们已经记录了此问题。
            <br />
            错误信息: <code className="text-xs bg-white px-1 py-0.5 rounded text-red-500 mt-2 block">{this.state.error?.message}</code>
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full text-sm font-medium transition-colors shadow-sm"
            >
              尝试恢复
            </button>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              重新加载系统
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
