/**
 * ============================================================================
 * Career Paths & Future Jobs - Multi-Topic Data Manager
 * Ms Trâm English Hub
 * ============================================================================
 * Quản lý các chủ đề đã nạp và cung cấp chủ đề hiện tại (Active Topic).
 */

(function () {
  'use strict';

  const TOPICS = window.TOPICS || {};
  let currentActiveId = null;

  /**
   * Lấy ID chủ đề đang được chọn
   */
  function getActiveTopicId() {
    if (currentActiveId && TOPICS[currentActiveId]) {
      return currentActiveId;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('cpv-active-topic');
        if (saved && TOPICS[saved]) {
          currentActiveId = saved;
          return saved;
        }
      }
    } catch (e) {}

    // Mặc định chọn chủ đề đầu tiên (thường là 'career')
    const keys = Object.keys(TOPICS);
    currentActiveId = keys.length ? keys[0] : 'career';
    return currentActiveId;
  }

  /**
   * Lưu ID chủ đề được chọn
   */
  function setActiveTopicId(id) {
    if (!TOPICS[id]) return false;
    currentActiveId = id;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cpv-active-topic', id);
      }
    } catch (e) {}
    syncActiveTopicGlobals();
    return true;
  }

  /**
   * Lấy đối tượng chủ đề hiện tại
   */
  function getActiveTopic() {
    const id = getActiveTopicId();
    return TOPICS[id] || null;
  }

  /**
   * Đồng bộ các biến toàn cục (W, PASS, CLUSTERS) theo chủ đề đang chọn
   * để tương thích liền mạch với toàn bộ logic hiện tại
   */
  function syncActiveTopicGlobals() {
    const active = getActiveTopic();
    if (active) {
      window.W = active.words;
      window.PASS = active.passages;
      window.CLUSTERS = active.clusters || [];
      window.CURRENT_TOPIC = active;
    }
  }

  // Khởi tạo ban đầu
  syncActiveTopicGlobals();

  // Xuất API
  window.TopicManager = {
    getAll: () => TOPICS,
    getActiveId: getActiveTopicId,
    setActiveId: setActiveTopicId,
    getActive: getActiveTopic,
    sync: syncActiveTopicGlobals
  };
})();
