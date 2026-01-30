declare module '@/components/Calendar' {
    import { Dayjs } from 'dayjs';

    interface CalendarProps {
        events: any[];
        onSelectDate?: (date: Dayjs) => void;
        selectedDate?: Dayjs;
        onDeleted?: () => void;
        onEdit?: (event: any) => void;
        currentUser?: any;
        onViewChange?: (date: Dayjs) => void;
    }

    export default function Calendar(props: CalendarProps): JSX.Element;
}

declare module '@/components/ScheduleForm' {
    import { Dayjs } from 'dayjs';

    interface ScheduleFormProps {
        selectedDate: Dayjs;
        onSaved: () => void;
        events?: any[];
    }

    export default function ScheduleForm(props: ScheduleFormProps): JSX.Element;
}

declare module '@/components/Chatbot' {
    interface ChatbotProps {
        events: any[];
        refreshSignal: number;
        isOpen: boolean;
        onToggle: (val: boolean) => void;
    }

    export default function Chatbot(props: ChatbotProps): JSX.Element;
}

declare module '@/components/NotificationBell' {
    interface NotificationBellProps {
        unreadCount: number;
        items: any[];
        onOpen?: () => void;
        onClose?: () => void;
        onSelectItem?: (item: any) => void;
        isOpen: boolean;
        onToggle: (val: boolean) => void;
    }

    export default function NotificationBell(props: NotificationBellProps): JSX.Element;
}

declare module '@/components/MiniCalendar' {
    import { Dayjs } from 'dayjs';

    interface MiniCalendarProps {
        selectedDate: Dayjs;
        onSelectDate: (date: Dayjs) => void;
        events: any[];
    }

    export default function MiniCalendar(props: MiniCalendarProps): JSX.Element;
}

declare module '@/components/UpcomingEvents' {
    interface UpcomingEventsProps {
        events: any[];
    }

    export default function UpcomingEvents(props: UpcomingEventsProps): JSX.Element;
}

declare module '@/components/AuthPanel' {
    interface AuthPanelProps {
        initialMode: 'login' | 'register';
        onAuth: (user: any) => void;
        onRegistered: () => void;
    }

    export default function AuthPanel(props: AuthPanelProps): JSX.Element;
}

declare module '@/components/LandingPage' {
    export default function LandingPage(): JSX.Element;
}

declare module '@/components/ProfileDropdown' {
    interface ProfileDropdownProps {
        user: {
            username: string;
            role: string;
            email?: string;
        };
        onLogout: () => void;
    }

    export default function ProfileDropdown(props: ProfileDropdownProps): JSX.Element;
}

declare module '@/components/EditScheduleForm' {
    interface EditScheduleFormProps {
        event: any;
        events: any[];
        onSaved: () => void;
        onCancel: () => void;
    }

    export default function EditScheduleForm(props: EditScheduleFormProps): JSX.Element;
}
