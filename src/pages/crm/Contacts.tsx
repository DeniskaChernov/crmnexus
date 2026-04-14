import React, { useEffect, useState } from 'react';
import { crm } from "@/lib/crmClient.ts";
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Card, CardContent } from '../../components/ui/card';
import { ClientDetailsSheet } from '../../components/crm/ClientDetailsSheet';
import { CreateContactDialog } from '../../components/crm/CreateContactDialog';
import { EditContactDialog } from '../../components/crm/EditContactDialog';
import { SendEmailDialog } from '../../components/crm/SendEmailDialog';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { AlertCircle, RefreshCcw, Search, User, Mail, Download, Pencil, Trash2, Loader2, Phone } from 'lucide-react';
import { downloadCSV, formatDateForExport } from '../../utils/exportUtils';
import { toast } from 'sonner@2.0.3';
import { useIsMobile } from '../../components/ui/use-mobile';

export default function Contacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await crm
        .from('contacts')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Не удалось загрузить контакты');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (contact: any) => {
    setSelectedContactId(contact.id);
    setDetailsSheetOpen(true);
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (contact: any) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    setDeletingContact(true);
    try {
      const { error } = await crm
        .from('contacts')
        .delete()
        .eq('id', contactToDelete.id);

      if (error) throw error;

      toast.success('Контакт удалён');
      fetchContacts();
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (err: any) {
      console.error('Error deleting contact:', err);
      toast.error('Ошибка при удалении контакта');
    } finally {
      setDeletingContact(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.first_name + ' ' + c.last_name).toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const exportContacts = () => {
    if (filteredContacts.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const exportData = filteredContacts.map(contact => ({
      'Имя': contact.first_name,
      'Фамилия': contact.last_name,
      'Должность': contact.position || '',
      'Компания': contact.companies?.name || '',
      'Email': contact.email || '',
      'Телефон': contact.phone || '',
      'Дата создания': formatDateForExport(contact.created_at)
    }));

    downloadCSV(exportData, `contacts-${new Date().toISOString().split('T')[0]}`);
    toast.success('Контакты экспортированы');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">B2C</h2>
          <p className="text-muted-foreground">Частные лица</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportContacts}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
          <CreateContactDialog onSuccess={fetchContacts} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchContacts} className="ml-4 bg-white text-red-600 hover:bg-red-50 border-red-200">
              <RefreshCcw className="mr-2 h-3 w-3" />
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-white">
        {isMobile ? (
           <div className="space-y-4 p-4">
             {loading ? (
                <div className="text-center py-8 text-slate-500">Загрузка...</div>
             ) : filteredContacts.length === 0 && !error ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-20" />
                  <p>Нет контактов</p>
                </div>
             ) : (
                filteredContacts.map(contact => (
                  <Card key={contact.id} onClick={() => handleViewDetails(contact)} className="shadow-none border border-slate-200">
                     <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</div>
                              <div className="text-xs text-muted-foreground">{contact.position}</div>
                              {contact.companies?.name && (
                                <div className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded">
                                   {contact.companies.name}
                                </div>
                              )}
                           </div>
                        </div>
                        
                        <div className="space-y-1">
                            {contact.phone && (
                               <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{contact.phone}</span>
                               </div>
                            )}
                            {contact.email && (
                               <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate max-w-[200px]">{contact.email}</span>
                               </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                            {contact.email && (
                              <SendEmailDialog
                                recipientEmail={contact.email}
                                recipientName={`${contact.first_name} ${contact.last_name}`}
                                trigger={
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                    <Mail className="h-4 w-4 text-slate-400" />
                                  </Button>
                                }
                              />
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleEditContact(contact); }}>
                                <Pencil className="h-4 w-4 text-slate-400" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleDeleteClick(contact); }}>
                                <Trash2 className="h-4 w-4 text-slate-400" />
                            </Button>
                        </div>
                     </CardContent>
                  </Card>
                ))
             )}
           </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Компания</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Загрузка...</TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 && !error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <User className="h-8 w-8 mb-2 opacity-20" />
                    <p>Нет контактов</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-slate-50" onClick={() => handleViewDetails(contact)}>
                  <TableCell className="font-medium">
                    <span className="hover:underline text-slate-900">{contact.first_name} {contact.last_name}</span>
                    <div className="text-xs text-muted-foreground">{contact.position}</div>
                  </TableCell>
                  <TableCell>{contact.companies?.name || '-'}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {contact.email && (
                      <SendEmailDialog
                        recipientEmail={contact.email}
                        recipientName={`${contact.first_name} ${contact.last_name}`}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Mail className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditContact(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}
      </div>

      <ClientDetailsSheet
        contactId={selectedContactId}
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
      />

      <EditContactDialog
        contact={editingContact}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchContacts}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот контакт? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={deletingContact}
            >
              {deletingContact ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Удалить'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}