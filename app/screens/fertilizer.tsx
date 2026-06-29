import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../../constants/theme';
import { useToast } from '../../context/ToastContext';
import {
  getFertilizerProducts,
  addFertilizerProduct,
  updateFertilizerProduct,
  deleteFertilizerProduct,
  getFertilizerRecipes,
  addFertilizerRecipe,
  updateFertilizerRecipe,
  deleteFertilizerRecipe,
  type FertilizerProduct,
  type FertilizerRecipe,
  type NewFertilizerRecipe,
} from '../../logic/fertilizerLogic';

type Tab = 'products' | 'recipes';
type ProductRow = { rowId: string; product_id: string; amount: string };
type AppMethod = 'spray' | 'soil_drench' | 'other';

const METHOD_LABELS: Record<AppMethod, string> = {
  spray:       'Spray',
  soil_drench: 'Soil drench',
  other:       'Other',
};

export default function FertilizerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('products');

  // ── Products ───────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<FertilizerProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FertilizerProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('');
  const [fieldRatio, setFieldRatio] = useState('');
  const [fieldNotes, setFieldNotes] = useState('');

  // ── Recipes ────────────────────────────────────────────────────────────────
  const [recipes, setRecipes] = useState<FertilizerRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesLoaded, setRecipesLoaded] = useState(false);

  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<FertilizerRecipe | null>(null);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [rFieldName, setRFieldName] = useState('');
  const [rFieldInstructions, setRFieldInstructions] = useState('');
  const [rProductRows, setRProductRows] = useState<ProductRow[]>([]);
  const [rFieldAppliesTo, setRFieldAppliesTo] = useState('');
  const [rFieldMethod, setRFieldMethod] = useState<AppMethod | null>(null);
  const [rFieldFrequency, setRFieldFrequency] = useState('');
  const [rFieldNotes, setRFieldNotes] = useState('');

  const mountedRef = useRef(true);
  const nextRowId = useRef(0);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Products fetched on mount — available as picker options in the recipe modal too
  useEffect(() => {
    getFertilizerProducts()
      .then(data => { if (mountedRef.current) setProducts(data); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, []);

  // Lazy-load recipes on first switch to the Recipes tab
  useEffect(() => {
    if (activeTab !== 'recipes' || recipesLoaded) return;
    setRecipesLoading(true);
    getFertilizerRecipes()
      .then(data => { if (mountedRef.current) setRecipes(data); })
      .finally(() => {
        if (mountedRef.current) {
          setRecipesLoading(false);
          setRecipesLoaded(true);
        }
      });
  }, [activeTab, recipesLoaded]);

  // ── Product handlers ───────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingProduct(null);
    setFieldName(''); setFieldType(''); setFieldRatio(''); setFieldNotes('');
    setModalVisible(true);
  };

  const openEdit = (product: FertilizerProduct) => {
    setEditingProduct(product);
    setFieldName(product.name);
    setFieldType(product.type ?? '');
    setFieldRatio(product.manufacturer_ratio ?? '');
    setFieldNotes(product.notes ?? '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingProduct(null);
    setFieldName(''); setFieldType(''); setFieldRatio(''); setFieldNotes('');
  };

  const handleSave = async () => {
    const name = fieldName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const payload = {
        name,
        type:               fieldType.trim() || null,
        manufacturer_ratio: fieldRatio.trim() || null,
        notes:              fieldNotes.trim() || null,
      };
      if (editingProduct) {
        const ok = await updateFertilizerProduct(editingProduct.id, payload);
        if (ok) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...payload } : p));
          showToast('Product updated', 'success');
          closeModal();
        } else {
          showToast('Failed to update product', 'error');
        }
      } else {
        const saved = await addFertilizerProduct(payload);
        if (saved) {
          setProducts(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
          showToast('Product added', 'success');
          closeModal();
        } else {
          showToast('Failed to add product', 'error');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: FertilizerProduct) => {
    const doDelete = async () => {
      await deleteFertilizerProduct(product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast('Product deleted', 'success');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${product.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete product', `Delete "${product.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { doDelete(); } },
      ]);
    }
  };

  // ── Recipe handlers ────────────────────────────────────────────────────────

  const openAddRecipe = () => {
    setEditingRecipe(null);
    setRFieldName(''); setRFieldInstructions(''); setRProductRows([]);
    setRFieldAppliesTo(''); setRFieldMethod(null);
    setRFieldFrequency(''); setRFieldNotes('');
    setRecipeModalVisible(true);
  };

  const openEditRecipe = (recipe: FertilizerRecipe) => {
    setEditingRecipe(recipe);
    setRFieldName(recipe.name);
    setRFieldInstructions(recipe.instructions ?? '');
    setRProductRows(recipe.products.map(p => ({
      rowId:      String(nextRowId.current++),
      product_id: p.product_id,
      amount:     p.amount ?? '',
    })));
    setRFieldAppliesTo(recipe.applies_to ?? '');
    setRFieldMethod(recipe.application_method);
    setRFieldFrequency(recipe.frequency ?? '');
    setRFieldNotes(recipe.notes ?? '');
    setRecipeModalVisible(true);
  };

  const closeRecipeModal = () => {
    setRecipeModalVisible(false);
    setEditingRecipe(null);
    setRProductRows([]);
    setRFieldName(''); setRFieldInstructions('');
    setRFieldAppliesTo(''); setRFieldMethod(null);
    setRFieldFrequency(''); setRFieldNotes('');
  };

  const addProductRow = () =>
    setRProductRows(prev => [
      ...prev,
      { rowId: String(nextRowId.current++), product_id: '', amount: '' },
    ]);

  const removeProductRow = (rowId: string) =>
    setRProductRows(prev => prev.filter(r => r.rowId !== rowId));

  const updateProductRow = (rowId: string, field: 'product_id' | 'amount', value: string) =>
    setRProductRows(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r));

  const handleSaveRecipe = async () => {
    const name = rFieldName.trim();
    if (!name || recipeSaving) return;
    setRecipeSaving(true);
    try {
      const recipePayload: NewFertilizerRecipe = {
        name,
        instructions:       rFieldInstructions.trim() || null,
        applies_to:         rFieldAppliesTo.trim() || null,
        application_method: rFieldMethod,
        frequency:          rFieldFrequency.trim() || null,
        notes:              rFieldNotes.trim() || null,
      };
      // Only rows where the user actually selected a product
      const productLinks = rProductRows
        .filter(r => r.product_id)
        .map(r => ({ product_id: r.product_id, amount: r.amount.trim() || null }));

      // Enrich local state with product names from the already-loaded products list
      const enrichLinks = (links: typeof productLinks) =>
        links.map(p => ({
          product_id:   p.product_id,
          product_name: products.find(pr => pr.id === p.product_id)?.name ?? null,
          amount:       p.amount,
        }));

      if (editingRecipe) {
        const ok = await updateFertilizerRecipe(editingRecipe.id, recipePayload, productLinks);
        if (ok) {
          setRecipes(prev =>
            prev.map(r => r.id === editingRecipe.id
              ? { ...editingRecipe, ...recipePayload, products: enrichLinks(productLinks) }
              : r,
            ).sort((a, b) => a.name.localeCompare(b.name)),
          );
          showToast('Recipe updated', 'success');
          closeRecipeModal();
        } else {
          showToast('Failed to update recipe', 'error');
        }
      } else {
        const saved = await addFertilizerRecipe(recipePayload, productLinks);
        if (saved) {
          setRecipes(prev =>
            [...prev, { ...saved, products: enrichLinks(productLinks) }]
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
          showToast('Recipe added', 'success');
          closeRecipeModal();
        } else {
          showToast('Failed to add recipe', 'error');
        }
      }
    } finally {
      setRecipeSaving(false);
    }
  };

  const handleDeleteRecipe = (recipe: FertilizerRecipe) => {
    const doDelete = async () => {
      await deleteFertilizerRecipe(recipe.id);
      setRecipes(prev => prev.filter(r => r.id !== recipe.id));
      showToast('Recipe deleted', 'success');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${recipe.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete recipe', `Delete "${recipe.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { doDelete(); } },
      ]);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderProduct = ({ item }: { item: FertilizerProduct }) => (
    <TouchableOpacity style={s.card} onPress={() => openEdit(item)} activeOpacity={0.75}>
      <View style={s.cardHeader}>
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      {!!item.type && <View style={s.typePill}><Text style={s.typeText}>{item.type}</Text></View>}
      {!!item.manufacturer_ratio && <Text style={s.secondaryText}>{item.manufacturer_ratio}</Text>}
      {!!item.notes && <Text style={s.mutedText} numberOfLines={2}>{item.notes}</Text>}
    </TouchableOpacity>
  );

  const renderRecipe = ({ item }: { item: FertilizerRecipe }) => (
    <TouchableOpacity style={s.card} onPress={() => openEditRecipe(item)} activeOpacity={0.75}>
      <View style={s.cardHeader}>
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity onPress={() => handleDeleteRecipe(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      {!!item.applies_to && <Text style={s.secondaryText}>{item.applies_to}</Text>}
      {(!!item.application_method || !!item.frequency) && (
        <View style={s.pillRow}>
          {!!item.application_method && (
            <View style={s.typePill}><Text style={s.typeText}>{METHOD_LABELS[item.application_method]}</Text></View>
          )}
          {!!item.frequency && (
            <View style={s.neutralPill}><Text style={s.neutralPillText}>{item.frequency}</Text></View>
          )}
        </View>
      )}
      {item.products.length > 0 && (
        <View style={s.chipRow}>
          {item.products.map((p, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>
                {p.product_name ?? 'Unknown'}{p.amount ? ` · ${p.amount}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!!item.notes && <Text style={s.mutedText} numberOfLines={2}>{item.notes}</Text>}
    </TouchableOpacity>
  );

  const ProductsHeader = (
    <TouchableOpacity style={s.addBtn} onPress={openAdd}>
      <Text style={s.addBtnText}>+ Add product</Text>
    </TouchableOpacity>
  );

  const RecipesHeader = (
    <TouchableOpacity style={s.addBtn} onPress={openAddRecipe}>
      <Text style={s.addBtnText}>+ Add recipe</Text>
    </TouchableOpacity>
  );

  const ProductsEmpty = (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>🌿</Text>
      <Text style={s.emptyTitle}>No products yet</Text>
      <Text style={s.emptyBody}>Add the fertilizers you own so you can reference them when building recipes.</Text>
      <TouchableOpacity style={s.emptyActionBtn} onPress={openAdd}>
        <Text style={s.emptyActionBtnText}>Add product</Text>
      </TouchableOpacity>
    </View>
  );

  const RecipesEmpty = (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>🧪</Text>
      <Text style={s.emptyTitle}>No recipes yet</Text>
      <Text style={s.emptyBody}>Document your fertilizing approach — what you mix, how much, and how often.</Text>
      <TouchableOpacity style={s.emptyActionBtn} onPress={openAddRecipe}>
        <Text style={s.emptyActionBtnText}>Add recipe</Text>
      </TouchableOpacity>
    </View>
  );

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Header — identical pattern to leaderboard.tsx / compare.tsx */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Fertilizer</Text>
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, activeTab === 'products' && s.tabActive]} onPress={() => setActiveTab('products')}>
          <Text style={[s.tabText, activeTab === 'products' && s.tabTextActive]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'recipes' && s.tabActive]} onPress={() => setActiveTab('recipes')}>
          <Text style={[s.tabText, activeTab === 'recipes' && s.tabTextActive]}>Recipes</Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      {activeTab === 'products' ? (
        loading ? (
          <View style={s.centered}><ActivityIndicator size="large" color={theme.accent} /></View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={item => item.id}
            renderItem={renderProduct}
            ListHeaderComponent={ProductsHeader}
            ListEmptyComponent={ProductsEmpty}
            contentContainerStyle={[s.list, products.length === 0 && s.listEmpty]}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : (
        recipesLoading ? (
          <View style={s.centered}><ActivityIndicator size="large" color={theme.accent} /></View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={item => item.id}
            renderItem={renderRecipe}
            ListHeaderComponent={RecipesHeader}
            ListEmptyComponent={RecipesEmpty}
            contentContainerStyle={[s.list, recipes.length === 0 && s.listEmpty]}
            keyboardShouldPersistTaps="handled"
          />
        )
      )}

      {/* ── Product modal ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{editingProduct ? 'Edit product' : 'Add product'}</Text>

            <Text style={s.modalLabel}>NAME *</Text>
            <TextInput style={s.modalInput} value={fieldName} onChangeText={setFieldName}
              placeholder="e.g. GrowMaster 3-1-2" placeholderTextColor={theme.textMuted}
              autoCapitalize="words" returnKeyType="next" />

            <Text style={s.modalLabel}>TYPE (optional)</Text>
            <TextInput style={s.modalInput} value={fieldType} onChangeText={setFieldType}
              placeholder="e.g. liquid concentrate" placeholderTextColor={theme.textMuted}
              autoCapitalize="sentences" returnKeyType="next" />

            <Text style={s.modalLabel}>MANUFACTURER RATIO (optional)</Text>
            <TextInput style={s.modalInput} value={fieldRatio} onChangeText={setFieldRatio}
              placeholder="e.g. 1 tsp per gallon" placeholderTextColor={theme.textMuted}
              autoCapitalize="none" returnKeyType="next" />

            <Text style={s.modalLabel}>NOTES (optional)</Text>
            <TextInput style={[s.modalInput, s.modalInputMultiline]} value={fieldNotes} onChangeText={setFieldNotes}
              placeholder="e.g. Use half strength for seedlings" placeholderTextColor={theme.textMuted}
              multiline numberOfLines={3} textAlignVertical="top" />

            <TouchableOpacity style={[s.modalSaveBtn, (!fieldName.trim() || saving) && s.btnDisabled]}
              onPress={handleSave} disabled={!fieldName.trim() || saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.modalSaveBtnText}>{editingProduct ? 'Save changes' : 'Add product'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={closeModal} style={s.modalCancelBtn}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Recipe modal ───────────────────────────────────────────────────── */}
      <Modal visible={recipeModalVisible} transparent animationType="fade" onRequestClose={closeRecipeModal}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, s.modalBoxTall]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.recipeModalContent} showsVerticalScrollIndicator={false}>

              <Text style={s.modalTitle}>{editingRecipe ? 'Edit recipe' : 'Add recipe'}</Text>

              <Text style={s.modalLabel}>NAME *</Text>
              <TextInput style={s.modalInput} value={rFieldName} onChangeText={setRFieldName}
                placeholder="e.g. Carnivorous plant spray mix" placeholderTextColor={theme.textMuted}
                autoCapitalize="sentences" returnKeyType="next" />

              <Text style={s.modalLabel}>INSTRUCTIONS (optional)</Text>
              <TextInput style={[s.modalInput, s.modalInputMultiline]} value={rFieldInstructions} onChangeText={setRFieldInstructions}
                placeholder="e.g. 0.2ml of each into 1L spray bottle" placeholderTextColor={theme.textMuted}
                multiline numberOfLines={3} textAlignVertical="top" />

              <Text style={s.modalLabel}>PRODUCTS (optional)</Text>
              {products.length === 0 ? (
                <Text style={s.noProductsHint}>
                  You haven't added any products yet — you can still save this recipe without linking one.
                </Text>
              ) : (
                <>
                  {rProductRows.map(row => (
                    <View key={row.rowId} style={s.productRowContainer}>
                      <View style={s.productRowHeader}>
                        <Text style={s.productRowLabel}>SELECT PRODUCT</Text>
                        <TouchableOpacity onPress={() => removeProductRow(row.rowId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={s.productRowRemove}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={s.productPillsRow}>
                          {products.map(p => (
                            <TouchableOpacity
                              key={p.id}
                              style={[s.productSelectPill, row.product_id === p.id && s.productSelectPillActive]}
                              onPress={() => updateProductRow(row.rowId, 'product_id', p.id)}
                            >
                              <Text style={[s.productSelectText, row.product_id === p.id && s.productSelectTextActive]}>
                                {p.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <TextInput
                        style={[s.modalInput, s.productAmountInput]}
                        value={row.amount}
                        onChangeText={v => updateProductRow(row.rowId, 'amount', v)}
                        placeholder="Amount (e.g. 0.2ml)"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                  ))}
                  <TouchableOpacity style={s.addProductRowBtn} onPress={addProductRow}>
                    <Text style={s.addProductRowBtnText}>+ Add product</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={s.modalLabel}>APPLIES TO (optional)</Text>
              <TextInput style={s.modalInput} value={rFieldAppliesTo} onChangeText={setRFieldAppliesTo}
                placeholder="e.g. Nepenthes, carnivorous plants" placeholderTextColor={theme.textMuted}
                autoCapitalize="sentences" />

              <Text style={s.modalLabel}>APPLICATION METHOD</Text>
              <View style={s.methodRow}>
                {(['spray', 'soil_drench', 'other'] as AppMethod[]).map(method => (
                  <TouchableOpacity
                    key={method}
                    style={[s.methodPill, rFieldMethod === method && s.methodPillActive]}
                    onPress={() => setRFieldMethod(rFieldMethod === method ? null : method)}
                  >
                    <Text style={[s.methodPillText, rFieldMethod === method && s.methodPillTextActive]}>
                      {METHOD_LABELS[method]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.modalLabel}>FREQUENCY (optional)</Text>
              <TextInput style={s.modalInput} value={rFieldFrequency} onChangeText={setRFieldFrequency}
                placeholder="e.g. every 2 weeks" placeholderTextColor={theme.textMuted}
                autoCapitalize="sentences" />

              <Text style={s.modalLabel}>NOTES (optional)</Text>
              <TextInput style={[s.modalInput, s.modalInputMultiline]} value={rFieldNotes} onChangeText={setRFieldNotes}
                placeholder="e.g. Manufacturer's ratio is too strong for these" placeholderTextColor={theme.textMuted}
                multiline numberOfLines={3} textAlignVertical="top" />

              <TouchableOpacity
                style={[s.modalSaveBtn, (!rFieldName.trim() || recipeSaving) && s.btnDisabled]}
                onPress={handleSaveRecipe}
                disabled={!rFieldName.trim() || recipeSaving}
              >
                {recipeSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalSaveBtnText}>{editingRecipe ? 'Save changes' : 'Add recipe'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeRecipeModal} style={s.modalCancelBtn}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
    gap: 8,
  },
  backBtn:   { paddingRight: 4 },
  backArrow: { fontSize: 30, color: t.accent, lineHeight: 32 },
  title:     { fontSize: 20, fontWeight: '800', color: t.textTitle },

  tabRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: t.background },
  tabActive:    { backgroundColor: t.accent },
  tabText:      { fontSize: 14, fontWeight: '700', color: t.textMuted },
  tabTextActive:{ color: '#fff' },

  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, gap: 10, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },

  addBtn:    { backgroundColor: t.accent, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 6 },
  addBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  // Card — shared by product and recipe cards
  card:         { backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border, gap: 6 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName:     { flex: 1, fontSize: 16, fontWeight: '800', color: t.textPrimary },
  deleteBtn:    { padding: 4 },
  deleteBtnText:{ fontSize: 14, color: t.textMuted },
  secondaryText:{ fontSize: 13, color: t.textSecondary },
  mutedText:    { fontSize: 13, color: t.textMuted, lineHeight: 18 },

  // Pills used on cards
  typePill:       { alignSelf: 'flex-start', backgroundColor: t.surfaceGreenSubtle, borderWidth: 1, borderColor: t.borderGreen, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  typeText:       { fontSize: 12, color: t.accentDark, fontWeight: '600' },
  pillRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  neutralPill:    { alignSelf: 'flex-start', backgroundColor: t.background, borderWidth: 1, borderColor: t.border, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  neutralPillText:{ fontSize: 12, color: t.textSecondary, fontWeight: '600' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { backgroundColor: t.background, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:       { fontSize: 12, color: t.textSecondary },

  // Empty state
  emptyState:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 32 },
  emptyIcon:         { fontSize: 48, marginBottom: 12 },
  emptyTitle:        { fontSize: 20, fontWeight: '800', color: t.textTitle, marginBottom: 8, textAlign: 'center' },
  emptyBody:         { fontSize: 15, color: t.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyActionBtn:    { backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  emptyActionBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modal base — names match PlantPhotoGallery.tsx / WateringSection.tsx
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:           { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalBoxTall:       { padding: 0, maxHeight: '90%', overflow: 'hidden' },
  recipeModalContent: { padding: 24 },
  modalTitle:         { fontSize: 18, fontWeight: '800', color: t.textTitle, marginBottom: 4 },
  modalLabel:         { fontSize: 12, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput:         { backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.textPrimary },
  modalInputMultiline:{ minHeight: 72, textAlignVertical: 'top' },
  modalSaveBtn:       { backgroundColor: t.accent, padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  modalSaveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn:     { alignItems: 'center', paddingVertical: 12 },
  modalCancelText:    { color: t.textMuted, fontSize: 14, fontWeight: '600' },
  btnDisabled:        { opacity: 0.5 },

  // Recipe modal — product rows
  noProductsHint:      { fontSize: 13, color: t.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 18 },
  productRowContainer: { marginTop: 10, backgroundColor: t.background, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 12 },
  productRowHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  productRowLabel:     { fontSize: 11, fontWeight: '700', color: t.textMuted, letterSpacing: 0.6 },
  productRowRemove:    { fontSize: 14, color: t.textMuted },
  productPillsRow:     { flexDirection: 'row', gap: 6, paddingVertical: 4, marginBottom: 8 },
  productSelectPill:       { borderWidth: 1.5, borderColor: t.border, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.surface },
  productSelectPillActive: { borderColor: t.accent, backgroundColor: t.accent },
  productSelectText:       { fontSize: 13, color: t.textMuted, fontWeight: '600' },
  productSelectTextActive: { color: '#fff' },
  productAmountInput:  { marginTop: 4 },
  addProductRowBtn:    { marginTop: 10, borderWidth: 1.5, borderColor: t.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: t.surfaceGreenSubtle },
  addProductRowBtnText:{ color: t.accent, fontWeight: '700', fontSize: 14 },

  // Recipe modal — application method pills
  methodRow:           { flexDirection: 'row', gap: 8, marginTop: 4 },
  methodPill:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: t.background, borderWidth: 1.5, borderColor: t.border },
  methodPillActive:    { backgroundColor: t.accent, borderColor: t.accent },
  methodPillText:      { fontSize: 12, fontWeight: '700', color: t.textMuted },
  methodPillTextActive:{ color: '#fff' },
});
